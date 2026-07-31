// Les quelques recettes qui doivent rester identiques d'un écran à l'autre.
//
// Trois choses qu'on ne trouvera pas ici, volontairement : pas d'ombre (une
// surface se détache par sa valeur et une arête de sa propre couleur), pas de
// soulèvement au survol, et pas de `dark:` (les jetons de globals.css
// basculent seuls).

/** Surface posée sur le papier. L'arête est de la couleur de la surface. */
export const cadre = "cadre";

/**
 * L'action principale est en encre pleine. Pas de duo plein/contour : un écran
 * a une action, et les autres chemins sont des liens.
 */
export const action =
  "inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] " +
  "bg-action px-4 py-2 text-sm font-medium text-action-texte " +
  "transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40";

/** Action secondaire : posée sur la surface creuse, jamais contournée. */
export const actionDouce =
  "inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] " +
  "bg-surface-creuse px-4 py-2 text-sm font-medium text-encre " +
  "transition-colors hover:bg-trait disabled:pointer-events-none disabled:opacity-40";

export const champ =
  "w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre " +
  "shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 " +
  "transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]";

/**
 * Les libellés ne portent pas tous le même costume : celui-ci est en corps de
 * texte, minuscules, simplement plus pâle. Les capitales traquées partout sont
 * un uniforme, pas une hiérarchie.
 */
export const legende = "block text-[13px] text-encre-3";

export const lien =
  "text-vif underline decoration-vif/30 underline-offset-[3px] " +
  "transition-colors hover:decoration-vif";

/**
 * L'action irréversible, et elle seule. C'est le seul endroit du site où une
 * couleur remplit un bouton : ici elle veut dire quelque chose. L'oxblood de
 * `--erreur` est désaturé, pas un rouge d'affiche.
 */
export const actionDanger =
  "inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] " +
  "bg-erreur px-4 py-2 text-sm font-medium text-white " +
  "transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40";
