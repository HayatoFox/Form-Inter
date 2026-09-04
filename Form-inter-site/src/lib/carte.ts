/**
 * Ce que les deux cartes du site ont en commun : leur fond, et leurs repères.
 *
 * Le module est neutre — ni `"use client"`, ni `server-only` — parce qu'il ne
 * contient que des constantes et une fonction pure. Les variables
 * `NEXT_PUBLIC_*` sont remplacées à la compilation dans le bundle du
 * navigateur, ce qui suppose de les lire par leur nom complet et non depuis un
 * accès dynamique à `process.env`.
 */

export const TUILES =
  process.env.NEXT_PUBLIC_TUILES_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const ATTRIBUTION =
  process.env.NEXT_PUBLIC_TUILES_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Le bleu du point de départ, le noir des centres — et une TROISIÈME couleur
 * pour le centre sélectionné. Le premier essai le passait en bleu : quand le
 * client et le centre sont dans la même ville, les deux repères se
 * superposaient et rien ne les distinguait plus.
 */
export const COULEUR_DEPART = "#2563eb";
export const COULEUR_CENTRE = "#18181b";
export const COULEUR_CHOISI = "#c2410c";

/**
 * Le repère, dessiné en SVG plutôt que chargé en image : les icônes de Leaflet
 * arrivent par des URL relatives à sa feuille de style, que le bundler
 * réécrit — elles finissent en 404 et les repères disparaissent.
 */
export function marqueur(couleur: string, taille = 26): string {
  const l = taille * 0.62;
  const c = l * 0.22;
  return `
    <svg width="${l}" height="${taille}" viewBox="0 0 ${l} ${taille}" aria-hidden="true"
         style="display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))">
      <path d="M${l / 2} ${taille}L0 ${l * 0.9}L0 ${c}L${c} 0L${l - c} 0L${l} ${c}L${l} ${l * 0.9}Z"
            style="fill:${couleur}" />
    </svg>`;
}

/**
 * Le même repère, surmonté du nombre de formations qui y correspondent.
 *
 * C'est ce compteur qui fait la carte : sans lui, dix repères identiques ne
 * disent pas où il y a une session et où il y en a trente.
 */
export function marqueurCompte(
  couleur: string,
  compte: number,
  taille = 30
): string {
  const rayon = compte > 99 ? 13 : compte > 9 ? 11 : 9;
  const largeur = taille * 0.62;
  return `
    <div style="position:relative;width:${largeur}px;height:${taille}px">
      ${marqueur(couleur, taille)}
      <span style="position:absolute;top:${-rayon * 0.7}px;left:${
        largeur / 2
      }px;transform:translateX(-50%);
                   min-width:${rayon * 2}px;height:${rayon * 2}px;
                   display:flex;align-items:center;justify-content:center;
                   padding:0 3px;border-radius:${rayon}px;
                   background:${couleur};color:#fff;border:1.5px solid #fff;
                   font:600 ${rayon}px/1 system-ui,sans-serif;
                   box-shadow:0 1px 2px rgba(0,0,0,.3)">${
                     compte > 99 ? "99+" : compte
                   }</span>
    </div>`;
}
