import "server-only";

/**
 * L'autocomplétion d'adresses — et pourquoi ce n'est PAS Nominatim.
 *
 * La politique d'usage de Nominatim interdit explicitement l'autocomplétion
 * sur son instance publique : une frappe au clavier ne doit pas produire une
 * requête. Nous n'avions donc, dans un premier temps, que nos propres adresses
 * à proposer — utile pour retrouver ce qu'on avait déjà cherché, inutile pour
 * aider à taper une adresse neuve, qui est tout l'intérêt de la chose.
 *
 * La bonne source existe et elle est faite pour ça : la **Base Adresse
 * Nationale**, service public, sans clé, dimensionné pour l'autocomplétion —
 * ici via la Géoplateforme de l'IGN qui l'héberge. `api-adresse.data.gouv.fr`
 * expose le même contrat : `ADRESSE_API_URL` permet de basculer de l'un à
 * l'autre sans toucher au code.
 *
 * Deux propriétés qui changent tout par rapport à Nominatim :
 *
 * - elle rend les COORDONNÉES avec chaque proposition. Choisir une suggestion
 *   n'a donc plus besoin d'un géocodage : le point de départ est connu, et le
 *   quota de Nominatim n'est pas entamé du tout ;
 * - couverture France entière, y compris les numéros de rue, ce qui est
 *   exactement le périmètre du catalogue.
 *
 * Trois garde-fous quand même, parce qu'un champ de saisie est une machine à
 * faire des requêtes : un cache en mémoire des préfixes déjà demandés, un délai
 * d'attente court (une autocomplétion en retard ne sert plus à rien), et un
 * échec silencieux — les suggestions sont un confort, leur absence ne doit rien
 * annoncer à l'écran.
 */

const BASE = process.env.ADRESSE_API_URL ?? "https://data.geopf.fr/geocodage";

// Une suggestion qui arrive après deux secondes et demie est arrivée trop tard.
const DELAI_MS = 2500;

// Le cache absorbe les retours en arrière : effacer une lettre puis la
// retaper ne repart pas sur le réseau.
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 300;

export type AdresseProposee = {
  libelle: string;
  detail: string;
  latitude: number;
  longitude: number;
  /** « adresse » (numéro), « voie », « commune » ou « lieu-dit ». */
  precision: "adresse" | "voie" | "commune" | "lieu-dit";
  // Les morceaux, séparément : le champ adresse d'un centre de formation les
  // range dans trois colonnes distinctes, et découper le libellé à coups
  // d'expression régulière serait fragile là où le service les donne déjà.
  rue?: string;
  codePostal?: string;
  ville?: string;
};

type Entree = { expire: number; resultats: AdresseProposee[] };
const cache = new Map<string, Entree>();
let panneSignalee = false;

function precisionDe(type: string): AdresseProposee["precision"] {
  if (type === "housenumber") return "adresse";
  if (type === "street") return "voie";
  if (type === "municipality") return "commune";
  return "lieu-dit";
}

const ETIQUETTE: Record<AdresseProposee["precision"], string> = {
  adresse: "Adresse",
  voie: "Voie",
  commune: "Commune",
  "lieu-dit": "Lieu-dit",
};

export async function chercherAdresses(
  saisie: string,
  limite = 6
): Promise<AdresseProposee[]> {
  // Le service demande au moins trois caractères, et en dessous une suggestion
  // n'aurait aucune valeur de toute façon.
  const texte = saisie.trim();
  if (texte.length < 3) return [];

  const cle = `${limite}|${texte.toLowerCase()}`;
  const connu = cache.get(cle);
  if (connu && connu.expire > Date.now()) return connu.resultats;

  const url = new URL(`${BASE.replace(/\/$/, "")}/search`);
  url.searchParams.set("q", texte);
  url.searchParams.set("autocomplete", "1");
  url.searchParams.set("limit", String(limite));

  try {
    const reponse = await fetch(url, {
      signal: AbortSignal.timeout(DELAI_MS),
      headers: {
        // On s'identifie, comme on le fait auprès de Nominatim : un service
        // public doit pouvoir joindre celui qui l'utilise.
        "User-Agent":
          process.env.NOMINATIM_USER_AGENT ??
          `Form-inter-site (${process.env.NOMINATIM_CONTACT ?? "contact non renseigné"})`,
        Accept: "application/json",
      },
      // Le cache HTTP de Next n'a rien à faire ici : c'est notre cache mémoire
      // qui décide, et lui sait expirer.
      cache: "no-store",
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const donnees = (await reponse.json()) as {
      features?: {
        geometry?: { coordinates?: [number, number] };
        properties?: {
          label?: string;
          type?: string;
          context?: string;
          city?: string;
          postcode?: string;
          name?: string;
        };
      }[];
    };

    const resultats: AdresseProposee[] = [];
    for (const trait of donnees.features ?? []) {
      const coordonnees = trait.geometry?.coordinates;
      const proprietes = trait.properties;
      if (!coordonnees || !proprietes?.label) continue;
      // GeoJSON ordonne en [longitude, latitude] — l'inverse de la lecture
      // courante, et l'inverser par distraction place les points en mer.
      const [longitude, latitude] = coordonnees;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const precision = precisionDe(proprietes.type ?? "");
      resultats.push({
        libelle: proprietes.label,
        detail: [ETIQUETTE[precision], proprietes.context]
          .filter(Boolean)
          .join(" · "),
        latitude,
        longitude,
        precision,
        // `name` vaut « 3 Boulevard de Dézerseul » pour une adresse, et le nom
        // de la commune pour une commune : dans ce dernier cas il n'y a pas de
        // rue à ranger.
        ...(precision === "adresse" || precision === "voie"
          ? { rue: proprietes.name }
          : {}),
        codePostal: proprietes.postcode,
        ville: proprietes.city,
      });
    }

    cache.set(cle, { expire: Date.now() + CACHE_MS, resultats });
    if (cache.size > CACHE_MAX) {
      // Map conserve l'ordre d'insertion : la plus ancienne clé est la première.
      const premiere = cache.keys().next();
      if (!premiere.done) cache.delete(premiere.value);
    }
    panneSignalee = false;
    return resultats;
  } catch (erreur) {
    // Une seule ligne de journal, pas une par frappe.
    if (!panneSignalee) {
      panneSignalee = true;
      console.warn(
        "Autocomplétion d'adresses indisponible :",
        erreur instanceof Error ? erreur.message : erreur
      );
    }
    return [];
  }
}
