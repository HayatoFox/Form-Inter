import "server-only";
import { prisma } from "@/lib/prisma";
import { chercherAdresses } from "@/lib/geo/adresse-api";

/**
 * Les adresses proposées pendant la frappe.
 *
 * Deux sources, dans cet ordre :
 *
 * 1. **Ce que le site connaît déjà** — les adresses des centres de formation,
 *    les villes où il y a un centre, et les adresses déjà cherchées par
 *    l'équipe (le cache de géocodage). Aucune requête sortante, et ce sont les
 *    réponses les plus souvent attendues : on retape rarement une adresse au
 *    hasard, on retourne chez un client.
 *
 * 2. **La Base Adresse Nationale**, pour tout le reste — c'est-à-dire pour la
 *    fonction principale d'une autocomplétion : aider à écrire une adresse
 *    qu'on n'a jamais tapée. Voir `adresse-api.ts` pour le choix du service.
 *
 * Presque toutes les suggestions portent leurs COORDONNÉES, quelle que soit la
 * source. Choisir dans la liste ne déclenche donc aucun géocodage : le point de
 * départ est déjà là. L'autocomplétion, qu'on croirait coûteuse, est ce qui
 * réduit le plus notre trafic sortant.
 */

export type Suggestion = {
  /** Ce qui sera écrit dans le champ. */
  libelle: string;
  /** Une ligne d'explication : qui, ou d'où ça vient. */
  detail: string;
  genre: "centre" | "ville" | "cache" | "adresse";
  /** Présentes dès qu'on sait situer la suggestion sans rien demander. */
  latitude?: number;
  longitude?: number;
  // Les morceaux, quand la source les distingue. Le formulaire d'un centre de
  // formation les range dans trois colonnes : sans eux, choisir une suggestion
  // remplirait une seule case avec « 3 Boulevard de Dézerseul 35510
  // Cesson-Sévigné », code postal et ville compris.
  rue?: string;
  codePostal?: string;
  ville?: string;
};

/**
 * Réduit une chaîne à sa forme comparable : sans accents, sans casse, sans
 * ponctuation superflue. « Cesson-Sevigne » doit trouver « Cesson-Sévigné », et
 * « RENNES » trouver « Rennes » — la comparaison brute de SQLite ne sait faire
 * ni l'un ni l'autre sur des caractères accentués.
 */
export function plier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Remet une majuscule en tête de chaque mot d'une clé de cache, minuscule. */
function presenter(texte: string): string {
  return texte.replace(/(^|[\s,'-])([a-zà-ÿ])/g, (_, avant, lettre) =>
    avant + lettre.toUpperCase()
  );
}

/** L'adresse complète d'un centre, telle qu'on la taperait. */
export function adresseComplete(centre: {
  adresse: string | null;
  codePostal: string | null;
  ville: string;
}): string {
  const rue = centre.adresse?.trim();
  const cp = centre.codePostal?.trim();
  const ville = centre.ville.trim();
  return [rue, [cp, ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

// Le cache peut grossir ; on ne relit pas tout pour proposer huit lignes. Les
// plus récemment utilisées sont aussi les plus probables.
const CACHE_RELU = 500;
// Nos propres adresses ne prennent pas toute la place : au-delà, la liste
// n'aiderait plus à écrire une adresse neuve.
const MAXIMUM_LOCAL = 4;

/** Nos adresses à nous. Aucune requête sortante. */
async function suggestionsLocales(cle: string): Promise<Suggestion[]> {
  const [centres, caches] = await Promise.all([
    prisma.centre.findMany({
      select: {
        adresse: true,
        codePostal: true,
        ville: true,
        latitude: true,
        longitude: true,
        organisme: { select: { nom: true } },
      },
      take: 1000,
    }),
    prisma.geocodage.findMany({
      where: { trouve: true },
      select: { requete: true, libelle: true, latitude: true, longitude: true },
      orderBy: { utiliseLe: "desc" },
      take: CACHE_RELU,
    }),
  ]);

  const candidates: Suggestion[] = [];
  const vues = new Set<string>();

  function ajouter(suggestion: Suggestion) {
    const empreinte = plier(suggestion.libelle);
    if (!empreinte || vues.has(empreinte)) return;
    vues.add(empreinte);
    candidates.push(suggestion);
  }

  for (const centre of centres) {
    if (!centre.adresse) continue;
    ajouter({
      libelle: adresseComplete(centre),
      detail: `Centre — ${centre.organisme.nom}`,
      genre: "centre",
      rue: centre.adresse,
      codePostal: centre.codePostal ?? undefined,
      ville: centre.ville,
      ...(centre.latitude !== null && centre.longitude !== null
        ? { latitude: centre.latitude, longitude: centre.longitude }
        : {}),
    });
  }

  // Les villes viennent des mêmes lignes : la première qui porte des
  // coordonnées les prête à la ville entière.
  const villes = new Map<string, { latitude?: number; longitude?: number }>();
  for (const centre of centres) {
    const existante = villes.get(centre.ville);
    if (existante?.latitude !== undefined) continue;
    villes.set(
      centre.ville,
      centre.latitude !== null && centre.longitude !== null
        ? { latitude: centre.latitude, longitude: centre.longitude }
        : {}
    );
  }
  for (const [ville, position] of villes) {
    ajouter({
      libelle: ville,
      detail: "Ville d'un centre de formation",
      genre: "ville",
      ville,
      ...position,
    });
  }

  for (const entree of caches) {
    ajouter({
      // La clé du cache est déjà normalisée : la réécrire avec des majuscules
      // ne change pas la clé sur laquelle la recherche retombera.
      libelle: presenter(entree.requete),
      detail: entree.libelle ?? "Déjà recherchée",
      genre: "cache",
      ...(entree.latitude !== null && entree.longitude !== null
        ? { latitude: entree.latitude, longitude: entree.longitude }
        : {}),
    });
  }

  // Ce qui commence par la saisie passe devant ce qui la contient : taper
  // « ren » doit proposer Rennes avant « 3 rue de Rennes, Paris ».
  return candidates
    .map((s) => ({ s, place: plier(s.libelle).indexOf(cle) }))
    .filter((c) => c.place >= 0)
    .sort(
      (a, b) =>
        a.place - b.place ||
        a.s.libelle.length - b.s.libelle.length ||
        a.s.libelle.localeCompare(b.s.libelle, "fr")
    )
    .map((c) => c.s);
}

export async function suggererAdresses(
  saisie: string,
  limite = 8
): Promise<Suggestion[]> {
  const cle = plier(saisie);
  if (cle.length < 2) return [];

  // Les deux sources sont interrogées de front : la locale répond en quelques
  // millisecondes, l'autre en une centaine, et les attendre l'une après l'autre
  // se verrait à la frappe.
  // On demande six adresses, pas huit : la queue de liste d'un service de
  // recherche floue est du bruit (« René 56130 Férel » pour « renn »), et un
  // seuil de score ne trie pas — les scores baissent avec la longueur de la
  // saisie, donc le même seuil couperait des résultats légitimes.
  const [locales, distantes] = await Promise.all([
    suggestionsLocales(cle),
    chercherAdresses(saisie, 6),
  ]);

  const retenues: Suggestion[] = [];
  const vues = new Set<string>();

  function ajouter(suggestion: Suggestion) {
    const empreinte = plier(suggestion.libelle);
    if (!empreinte || vues.has(empreinte) || retenues.length >= limite) return;
    vues.add(empreinte);
    retenues.push(suggestion);
  }

  for (const locale of locales.slice(0, MAXIMUM_LOCAL)) ajouter(locale);
  for (const distante of distantes) {
    ajouter({
      libelle: distante.libelle,
      detail: distante.detail,
      genre: "adresse",
      latitude: distante.latitude,
      longitude: distante.longitude,
      rue: distante.rue,
      codePostal: distante.codePostal,
      ville: distante.ville,
    });
  }
  // Si le service d'adresses n'a rien rendu — panne, ou requête trop courte
  // pour lui — nos propres adresses reprennent toute la place.
  for (const locale of locales) ajouter(locale);

  return retenues;
}
