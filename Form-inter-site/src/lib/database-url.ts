/**
 * L'unique endroit où se décide l'emplacement de la base du site.
 *
 * Il y en avait deux : `src/lib/prisma.ts` repliait sur `file:./dev.db` quand
 * `DATABASE_URL` manquait, et `prisma.config.ts` passait la variable telle
 * quelle à la CLI. Résultat sur un `.env` incomplet : l'application démarrait
 * et écrivait dans `dev.db`, pendant que `prisma migrate deploy` refusait de
 * tourner faute d'URL. Le schéma n'était jamais créé, et l'erreur qu'on lisait
 * (« The table main.Session does not exist ») ne parlait pas du vrai problème.
 *
 * Ce fichier est importé par les deux, sans alias de chemin ni dépendance :
 * `prisma.config.ts` est chargé par la CLI Prisma, hors du graphe Next.
 */

/** Base de développement par défaut, relative au dossier de lancement. */
export const BASE_PAR_DEFAUT = "file:./dev.db";

export function urlBaseDonnees(): string {
  const brute = process.env.DATABASE_URL?.trim();
  return brute && brute.length > 0 ? brute : BASE_PAR_DEFAUT;
}
