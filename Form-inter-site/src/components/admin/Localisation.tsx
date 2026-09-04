"use client";

import { useActionState } from "react";
import { localiser } from "@/app/admin/(dashboard)/sources/actions";
import { ETAT_VIDE } from "@/app/admin/(dashboard)/sources/etat";

/**
 * L'écran qui rend visible ce qui, sinon, se passerait en silence : combien de
 * centres ont des coordonnées, et combien n'en ont pas.
 *
 * C'est ce que le filtre par distance et la carte consomment. Un centre non
 * localisé disparaît simplement d'une recherche « à moins de 30 km » — sans ce
 * tableau de bord, on chercherait longtemps pourquoi.
 */
export function Localisation({
  etat,
  cache,
}: {
  etat: {
    total: number;
    ok: number;
    attente: number;
    introuvables: number;
    erreurs: number;
  };
  cache: { total: number; trouves: number; echecs: number };
}) {
  const [retour, envoyer, enCours] = useActionState(localiser, ETAT_VIDE);

  const reste = etat.attente + etat.erreurs;
  const part = etat.total > 0 ? Math.round((etat.ok / etat.total) * 100) : 0;

  const chiffres = [
    { libelle: "Localisés", valeur: `${etat.ok} / ${etat.total} (${part} %)` },
    { libelle: "En attente", valeur: String(etat.attente) },
    { libelle: "Adresse non reconnue", valeur: String(etat.introuvables) },
    { libelle: "En erreur", valeur: String(etat.erreurs), alerte: etat.erreurs > 0 },
  ];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold">Localisation des centres</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Les coordonnées d&apos;un centre sont résolues une fois puis
        conservées : une adresse de centre de formation ne bouge quasiment
        jamais. C&apos;est ce qui permet de filtrer par distance et
        d&apos;afficher une carte sans réinterroger OpenStreetMap.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {chiffres.map((c) => (
          <div key={c.libelle}>
            <dt className="text-xs font-medium text-zinc-500">{c.libelle}</dt>
            <dd
              className={`mt-1 text-sm font-medium tabular-nums ${
                c.alerte ? "text-amber-600" : ""
              }`}
            >
              {c.valeur}
            </dd>
          </div>
        ))}
      </dl>

      <form action={envoyer} className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {enCours ? "Localisation en cours…" : "Localiser les centres manquants"}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" name="reprendreEchecs" value="1" />
          Reprendre aussi les adresses non reconnues
        </label>
      </form>

      <p className="mt-3 text-xs text-zinc-500">
        Par lots de cinquante, à une requête par seconde — la cadence
        qu&apos;impose la politique d&apos;usage de Nominatim. Compter une
        minute par lot, et relancer tant qu&apos;il reste des centres :{" "}
        {reste > 0 ? `il en reste ${reste}.` : "il n'en reste aucun."}
      </p>

      {retour.statut !== "vide" && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            retour.statut === "erreur" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          {retour.message}
          {retour.detail && (
            <span className="mt-1 block text-xs text-zinc-500">
              {retour.detail}
            </span>
          )}
        </p>
      )}

      <p className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        Cache de géocodage : {cache.total} requête(s) mémorisée(s) —{" "}
        {cache.trouves} résolue(s) et {cache.echecs}{" "}
        {/* JSX rogne l'espace de tête d'un bloc de texte qui court sur
            plusieurs lignes : sans ce `{" "}` on lisait « 0sans résultat ». */}
        sans résultat. Chacune est
        un appel réseau que le site n&apos;a plus à refaire, y compris les
        échecs : sans eux, une adresse mal saisie repartirait sur le réseau à
        chaque affichage.
      </p>
    </div>
  );
}
