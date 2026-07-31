import { cleNormalisee } from "@/lib/backend/types";

// Repérage des domaines par la couleur.
//
// Un domaine n'est pas une couleur choisie mais une **teinte** : la pastille
// (`.pastille` dans globals.css) fixe la clarté et le chroma, seule la teinte
// varie. Toutes les pastilles ont donc le même poids visuel et le même
// contraste, en thème clair comme en thème sombre — ce qu'une liste de codes
// hexadécimaux choisis un par un ne sait pas garantir.
//
// Les quatorze domaines sont ceux que calcule `scraper/domaines.py`. Les teintes
// sont réparties tous les ~25° pour rester distinguables, et posées là où la
// convention aide (secourisme rouge, incendie orange, électricité ambre).
// Un domaine inconnu — nomenclature qui évolue, import manuel — reçoit une
// teinte dérivée de son nom : stable d'une page à l'autre, jamais absente.

const TEINTES: Record<string, number> = {
  secourisme: 25,
  incendie: 50,
  "habilitations electriques": 75,
  "risques chimiques": 100,
  "hygiene alimentaire": 130,
  "caces / conduite d'engins": 155,
  "gestes et postures / ergonomie": 180,
  "travail en hauteur": 205,
  "espaces confines (catec)": 230,
  aipr: 255,
  "formation de formateur": 280,
  ferroviaire: 305,
  "cse / cssct": 330,
  "risques psychosociaux / conflits": 355,
};

const PALETTE = [25, 50, 75, 100, 130, 155, 180, 205, 230, 255, 280, 305, 330, 355];

/** Teinte d'un domaine, en degrés oklch. */
export function teinteDomaine(nom: string | null | undefined): number {
  if (!nom) return 215; // « domaine non renseigné » : un bleu-gris neutre
  const cle = cleNormalisee(nom);
  const connue = TEINTES[cle];
  if (connue !== undefined) return connue;

  // Repli déterministe : deux visiteurs voient la même couleur pour le même
  // domaine, et elle ne change pas d'un rendu à l'autre.
  let empreinte = 0;
  for (let i = 0; i < cle.length; i++) {
    empreinte = (empreinte * 31 + cle.charCodeAt(i)) >>> 0;
  }
  return PALETTE[empreinte % PALETTE.length];
}

/** Style à poser sur un élément `.pastille` ou `.liseret-domaine`. */
export function styleDomaine(
  nom: string | null | undefined
): React.CSSProperties {
  return { "--h": teinteDomaine(nom) } as React.CSSProperties;
}
