import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Fusion de classes Tailwind : les dernières l'emportent sur les premières. */
export function cn(...entrees: ClassValue[]) {
  return twMerge(clsx(entrees))
}

/** Couleur stable d'un domaine : même libellé → même teinte partout.
 *  (Reprend la logique de l'ancien rendu serveur : somme des octets mod 8.) */
export function classeDomaine(domaine: string | null | undefined): string {
  if (!domaine) return 'dom dom-7'
  let somme = 0
  for (const octet of new TextEncoder().encode(domaine)) somme += octet
  return `dom dom-${somme % 8}`
}

const DIACRITIQUES = /[\u0300-\u036f]/g

/** Retire les accents et la casse — pour les recherches locales (comboboxes) :
 *  taper « rennes » doit trouver « Rennes », « evry » doit trouver « Évry ». */
export function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(DIACRITIQUES, '').toLowerCase()
}

export function contient(cible: string, recherche: string): boolean {
  return sansAccents(cible).includes(sansAccents(recherche))
}
