// Classes partagées de l'interface.
//
// Ce ne sont pas des composants : ce sont les quelques recettes qui doivent
// rester identiques d'une page à l'autre (surfaces, boutons, champs). Les
// regrouper ici évite qu'un écran dérive avec ses propres arrondis et ses
// propres gris — et surtout, aucune de ces recettes n'écrit `dark:` : les
// jetons sémantiques de globals.css basculent tout seuls.

export const carte = "rounded-xl border border-bordure bg-surface shadow-carte";

export const carteInteractive =
  carte +
  " transition-[box-shadow,border-color,transform] duration-150 " +
  "hover:border-bordure-forte hover:shadow-flottant";

export const boutonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 " +
  "text-sm font-medium transition-colors disabled:pointer-events-none " +
  "disabled:opacity-45";

export const boutonPrimaire =
  boutonBase + " bg-action text-action-texte hover:bg-action-survol";

export const boutonSecondaire =
  boutonBase +
  " border border-bordure-forte bg-surface text-texte hover:bg-surface-2";

export const boutonDiscret =
  boutonBase + " text-texte-doux hover:bg-surface-2 hover:text-texte";

export const boutonDanger =
  boutonBase + " bg-erreur text-white hover:opacity-90";

export const champ =
  "w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm " +
  "text-texte placeholder:text-texte-tenu transition-colors " +
  "hover:border-bordure-forte";

export const etiquette =
  "block text-xs font-medium tracking-wide text-texte-doux uppercase";

export const lien = "text-marque underline-offset-2 hover:underline";

/** Encart d'information, de succès ou d'erreur. */
export function encart(ton: "info" | "succes" | "alerte" | "erreur") {
  const tons = {
    info: "border-bordure bg-surface-2 text-texte-doux",
    succes: "border-succes/30 bg-succes-fond text-succes",
    alerte: "border-alerte/30 bg-alerte-fond text-alerte",
    erreur: "border-erreur/30 bg-erreur-fond text-erreur",
  };
  return `rounded-lg border px-4 py-2.5 text-sm ${tons[ton]}`;
}
