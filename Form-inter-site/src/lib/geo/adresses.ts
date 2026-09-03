import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Les adresses que le site connaît déjà, proposées à la saisie.
 *
 * Trois gisements, et le troisième est le plus utile :
 *
 * 1. les adresses des centres de formation ;
 * 2. les villes où il y a un centre ;
 * 3. **le cache de géocodage** — c'est-à-dire toutes les adresses de clients
 *    déjà cherchées par l'équipe. Choisir l'une d'elles ne coûte AUCUN appel à
 *    OpenStreetMap : la requête retombe exactement sur la clé du cache, qui
 *    répond de la base. Proposer ce qu'on a déjà résolu, c'est autant de trafic
 *    en moins vers un service qu'on n'a pas le droit de saturer.
 *
 * Rien ici ne sort sur le réseau : c'est une lecture de notre propre base.
 */

export type Suggestion = {
  /** Ce qui sera écrit dans le champ. */
  libelle: string;
  /** Une ligne d'explication : qui, ou d'où ça vient. */
  detail: string;
  genre: "centre" | "ville" | "cache";
  /** Le géocodage est déjà en cache : la recherche ne coûtera rien dehors. */
  immediat: boolean;
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

export async function suggererAdresses(
  saisie: string,
  limite = 8
): Promise<Suggestion[]> {
  const cle = plier(saisie);
  if (cle.length < 2) return [];

  const [centres, villes, caches] = await Promise.all([
    prisma.centre.findMany({
      where: { NOT: { adresse: null } },
      select: {
        adresse: true,
        codePostal: true,
        ville: true,
        organisme: { select: { nom: true } },
      },
      take: 500,
    }),
    prisma.centre.findMany({
      select: { ville: true },
      distinct: ["ville"],
      orderBy: { ville: "asc" },
    }),
    prisma.geocodage.findMany({
      where: { trouve: true },
      select: { requete: true, libelle: true },
      orderBy: { utiliseLe: "desc" },
      take: CACHE_RELU,
    }),
  ]);

  const candidates: Suggestion[] = [];
  const vues = new Set<string>();

  function ajouter(suggestion: Suggestion) {
    const cle = plier(suggestion.libelle);
    if (!cle || vues.has(cle)) return;
    vues.add(cle);
    candidates.push(suggestion);
  }

  for (const centre of centres) {
    ajouter({
      libelle: adresseComplete(centre),
      detail: `Centre — ${centre.organisme.nom}`,
      genre: "centre",
      immediat: false,
    });
  }
  for (const { ville } of villes) {
    ajouter({
      libelle: ville,
      detail: "Ville d'un centre de formation",
      genre: "ville",
      immediat: false,
    });
  }
  for (const entree of caches) {
    ajouter({
      // La clé du cache est déjà normalisée : la réécrire avec des majuscules
      // ne change pas la clé sur laquelle la recherche retombera.
      libelle: presenter(entree.requete),
      detail: entree.libelle ?? "Déjà recherchée",
      genre: "cache",
      immediat: true,
    });
  }

  // Ce qui commence par la saisie passe devant ce qui la contient : taper
  // « ren » doit proposer Rennes avant « 3 rue de Rennes, Paris ».
  const retenues = candidates
    .map((s) => ({ s, place: plier(s.libelle).indexOf(cle) }))
    .filter((c) => c.place >= 0)
    .sort(
      (a, b) =>
        a.place - b.place ||
        a.s.libelle.length - b.s.libelle.length ||
        a.s.libelle.localeCompare(b.s.libelle, "fr")
    )
    .slice(0, limite);

  return retenues.map((c) => c.s);
}
