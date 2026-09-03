/**
 * Les bornes du rayon de recherche, partagées par le serveur et le navigateur.
 *
 * Ce fichier existe pour une raison précise : la constante vivait d'abord dans
 * le composant du curseur, qui porte `"use client"`. Importée depuis un
 * composant serveur, une valeur exportée d'un module client n'arrive pas — elle
 * est remplacée par une référence côté client. `Math.min(150, undefined)` vaut
 * `NaN`, le rayon devenait `NaN`, et le filtre ne s'appliquait jamais : la page
 * rendait exactement les mêmes résultats à 0 comme à 150 km, sans la moindre
 * erreur. Une constante partagée entre les deux mondes doit vivre dans un
 * module neutre.
 */

/**
 * 200 km, pas 150. Les formations rares ne se donnent que dans quelques villes,
 * et le premier essai fait sur le jeu de démonstration — un client à Rennes,
 * le centre le plus proche à 153 km — tombait juste au-dessus de l'ancienne
 * borne : la carte restait vide alors qu'une réponse existait. Une demi-journée
 * de route reste une réponse utile quand il n'y en a pas d'autre.
 */
export const RAYON_MAX = 200;
export const RAYON_PAS = 10;

/** Ramène une saisie d'URL à un rayon utilisable. */
export function normaliserRayon(valeur: unknown): number {
  const km = Number(valeur);
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.min(Math.round(km), RAYON_MAX);
}

export function libelleRayon(km: number): string {
  return km <= 0 ? "la ville seule" : `${km} km autour`;
}
