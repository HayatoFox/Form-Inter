import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * L'unique porte de sortie vers un service de géocodage.
 *
 * Nominatim est gratuit et tenu par des bénévoles ; sa politique d'usage est
 * courte et sans ambiguïté : une requête par seconde au maximum, un
 * `User-Agent` qui identifie l'application et permet de la joindre, pas de
 * géocodage en masse, et les résultats doivent être mis en cache côté client.
 * Un site qui ne respecte pas ça se fait bloquer par adresse IP, sans
 * préavis, et le blocage frappe alors tout le réseau de l'entreprise.
 *
 * Trois garde-fous, tous ici pour qu'aucun appelant ne puisse les contourner :
 *
 * 1. LE CACHE D'ABORD. Toute requête passe par la table `Geocodage`, dans les
 *    deux sens. Les échecs sont mémorisés autant que les succès : sans cela,
 *    une adresse mal saisie repart sur le réseau à chaque affichage.
 * 2. UNE SEULE REQUÊTE À LA FOIS, cadencée. Les appels sont sérialisés dans
 *    une file et espacés d'au moins `PAUSE_MS`. Dix cartes ouvertes en même
 *    temps font dix requêtes espacées d'une seconde, pas dix requêtes
 *    simultanées.
 * 3. UN PLAFOND PAR PROCESSUS. Au-delà, on refuse plutôt que d'insister : un
 *    bug de boucle chez nous ne doit pas se payer d'un bannissement.
 *
 * L'instance est configurable (`NOMINATIM_URL`) : le jour où le volume le
 * justifie, on pointe sur une instance auto-hébergée sans toucher au code.
 */

const URL_DEFAUT = "https://nominatim.openstreetmap.org";

// La politique demande 1 req/s. On prend une marge : la latence réseau ne doit
// pas pouvoir faire tomber deux requêtes dans la même seconde.
const PAUSE_MS = 1200;
const DELAI_MS = 10_000;

// Plafond horaire par processus. Un géocodage de centres traite au plus
// quelques centaines d'adresses une fois pour toutes ; passé ce seuil, c'est
// une boucle, pas un usage.
const PLAFOND_PAR_HEURE = 400;

export type Coordonnees = {
  latitude: number;
  longitude: number;
  libelle: string;
};

export type ResultatGeocodage =
  | { trouve: true; coordonnees: Coordonnees; depuisCache: boolean }
  | { trouve: false; raison: "introuvable" | "plafond" | "erreur"; depuisCache: boolean };

/**
 * Clé du cache. Deux saisies qui désignent la même chose doivent tomber sur la
 * même clé, sinon le cache ne sert à rien : « 12 Rue de Paris, RENNES » et
 * « 12  rue de paris , rennes » sont la même requête.
 */
export function normaliser(requete: string): string {
  return requete
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

// --- La file d'attente -------------------------------------------------------

let chaine: Promise<unknown> = Promise.resolve();
let dernierAppel = 0;
let compteur = 0;
let debutFenetre = Date.now();

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sérialise et cadence : un seul appel réseau à la fois, espacés. */
function enFile<T>(travail: () => Promise<T>): Promise<T> {
  const resultat = chaine.then(async () => {
    const attente = PAUSE_MS - (Date.now() - dernierAppel);
    if (attente > 0) await dormir(attente);
    dernierAppel = Date.now();
    return travail();
  });

  // La file ne doit pas se rompre sur un échec : on absorbe ici, l'appelant
  // reçoit quand même son erreur par la promesse qu'on lui rend.
  chaine = resultat.catch(() => undefined);
  return resultat;
}

function plafondAtteint(): boolean {
  const maintenant = Date.now();
  if (maintenant - debutFenetre > 3_600_000) {
    debutFenetre = maintenant;
    compteur = 0;
  }
  return compteur >= PLAFOND_PAR_HEURE;
}

// --- Le cache ----------------------------------------------------------------

async function lireCache(cle: string) {
  const entree = await prisma.geocodage.findUnique({ where: { requete: cle } });
  if (!entree) return null;

  // Trace de fraîcheur, sans bloquer la lecture : sert au ménage du cache et à
  // savoir ce qui est réellement utilisé.
  prisma.geocodage
    .update({ where: { requete: cle }, data: { utiliseLe: new Date() } })
    .catch(() => undefined);

  return entree;
}

async function ecrireCache(
  cle: string,
  valeur: {
    trouve: boolean;
    latitude?: number;
    longitude?: number;
    libelle?: string;
    genre?: string;
  }
) {
  const donnees = {
    trouve: valeur.trouve,
    latitude: valeur.latitude ?? null,
    longitude: valeur.longitude ?? null,
    libelle: valeur.libelle ?? null,
    genre: valeur.genre ?? null,
    utiliseLe: new Date(),
  };
  await prisma.geocodage.upsert({
    where: { requete: cle },
    create: { requete: cle, ...donnees },
    update: donnees,
  });
}

// --- L'appel -----------------------------------------------------------------

function userAgent(): string {
  // Nominatim rejette les requêtes sans User-Agent identifiable, et c'est la
  // première cause de blocage. On refuse de partir sans, plutôt que d'envoyer
  // l'en-tête par défaut du runtime.
  const configure = process.env.NOMINATIM_USER_AGENT?.trim();
  if (configure) return configure;
  const contact = process.env.NOMINATIM_CONTACT?.trim();
  return `FormationsInter/1.0 (outil interne PROINSEC${contact ? `; ${contact}` : ""})`;
}

type ReponseNominatim = {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
  type?: string;
};

async function interroger(requete: string): Promise<ResultatGeocodage> {
  if (plafondAtteint()) {
    console.warn("[geo] plafond horaire atteint, requête refusée :", requete);
    return { trouve: false, raison: "plafond", depuisCache: false };
  }

  const base = (process.env.NOMINATIM_URL ?? URL_DEFAUT).replace(/\/+$/, "");
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", requete);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  // Le catalogue est français : restreindre écarte les homonymes lointains
  // (il y a un Rennes au Canada) et allège la recherche côté serveur.
  url.searchParams.set("countrycodes", process.env.NOMINATIM_PAYS ?? "fr");

  compteur += 1;

  try {
    const reponse = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        "Accept-Language": "fr",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(DELAI_MS),
      cache: "no-store",
    });

    if (reponse.status === 429 || reponse.status === 403) {
      // Le service nous demande de nous calmer. On ne réessaie pas en boucle :
      // insister sur un 429 est le meilleur moyen de transformer un
      // ralentissement en bannissement.
      console.error(
        `[geo] Nominatim répond ${reponse.status} : cadence dépassée ou accès refusé.`
      );
      return { trouve: false, raison: "erreur", depuisCache: false };
    }
    if (!reponse.ok) {
      console.error(`[geo] Nominatim répond ${reponse.status}`);
      return { trouve: false, raison: "erreur", depuisCache: false };
    }

    const donnees = (await reponse.json()) as ReponseNominatim[];
    const premier = donnees[0];
    if (!premier) return { trouve: false, raison: "introuvable", depuisCache: false };

    const latitude = Number(premier.lat);
    const longitude = Number(premier.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { trouve: false, raison: "erreur", depuisCache: false };
    }

    return {
      trouve: true,
      depuisCache: false,
      coordonnees: {
        latitude,
        longitude,
        libelle: premier.display_name ?? requete,
      },
    };
  } catch (erreur) {
    console.error("[geo] échec de l'appel Nominatim :", erreur);
    return { trouve: false, raison: "erreur", depuisCache: false };
  }
}

/**
 * Géocode une requête libre. Le cache est consulté d'abord, et rempli ensuite.
 *
 * `forcer` ignore le cache en lecture : réservé à une relance explicite depuis
 * le back office, jamais déclenché par une visite.
 */
export async function geocoder(
  requeteBrute: string,
  options: { genre?: string; forcer?: boolean } = {}
): Promise<ResultatGeocodage> {
  const cle = normaliser(requeteBrute);
  if (!cle) return { trouve: false, raison: "introuvable", depuisCache: true };

  if (!options.forcer) {
    const cache = await lireCache(cle);
    if (cache) {
      if (cache.trouve && cache.latitude !== null && cache.longitude !== null) {
        return {
          trouve: true,
          depuisCache: true,
          coordonnees: {
            latitude: cache.latitude,
            longitude: cache.longitude,
            libelle: cache.libelle ?? requeteBrute,
          },
        };
      }
      return { trouve: false, raison: "introuvable", depuisCache: true };
    }
  }

  const resultat = await enFile(() => interroger(cle));

  // Une panne réseau ou un plafond ne sont pas des réponses : les mettre en
  // cache figerait une adresse parfaitement valide en « introuvable ».
  if (resultat.trouve) {
    await ecrireCache(cle, {
      trouve: true,
      latitude: resultat.coordonnees.latitude,
      longitude: resultat.coordonnees.longitude,
      libelle: resultat.coordonnees.libelle,
      genre: options.genre,
    });
  } else if (resultat.raison === "introuvable") {
    await ecrireCache(cle, { trouve: false, genre: options.genre });
  }

  return resultat;
}

/** Ce que le cache contient déjà, sans jamais sortir sur le réseau. */
export async function geocoderDepuisCache(
  requeteBrute: string
): Promise<Coordonnees | null> {
  const entree = await lireCache(normaliser(requeteBrute));
  if (!entree?.trouve || entree.latitude === null || entree.longitude === null) {
    return null;
  }
  return {
    latitude: entree.latitude,
    longitude: entree.longitude,
    libelle: entree.libelle ?? requeteBrute,
  };
}

/** Diagnostic du back office : ce que le cache a évité comme appels. */
export async function statistiquesCache() {
  const [total, trouves] = await Promise.all([
    prisma.geocodage.count(),
    prisma.geocodage.count({ where: { trouve: true } }),
  ]);
  return { total, trouves, echecs: total - trouves };
}
