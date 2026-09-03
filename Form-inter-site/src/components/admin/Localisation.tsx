"use client";

import { useActionState } from "react";
import { localiser } from "@/app/admin/(dashboard)/sources/actions";
import { ETAT_VIDE } from "@/app/admin/(dashboard)/sources/etat";
import { Nombre } from "@/components/Nombre";
import { action } from "@/lib/ui";

/**
 * L'écran qui rend visible ce qui, sinon, se passerait en silence : combien de
 * centres ont des coordonnées, et combien n'en ont pas.
 *
 * C'est ce que le filtre par distance et la carte consomment. Un centre non
 * localisé disparaît simplement d'une recherche « à moins de 30 km » — sans
 * ce tableau de bord, on chercherait longtemps pourquoi.
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

  return (
    <div className="cadre p-6">
      <h2 className="signature text-[17px] text-encre">
        Localisation des centres
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-encre-2">
        Les coordonnées d&apos;un centre sont résolues une fois puis
        conservées : une adresse de centre de formation ne bouge quasiment
        jamais. C&apos;est ce qui permet de filtrer par distance et
        d&apos;afficher une carte sans réinterroger OpenStreetMap.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="text-[13px] text-encre-3">Localisés</dt>
          <dd className="donnee mt-1 text-sm text-encre">
            <Nombre valeur={etat.ok} /> / <Nombre valeur={etat.total} />
            <span className="text-encre-4"> ({part} %)</span>
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-encre-3">En attente</dt>
          <dd className="donnee mt-1 text-sm text-encre">
            <Nombre valeur={etat.attente} />
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-encre-3">Adresse non reconnue</dt>
          <dd className="donnee mt-1 text-sm text-encre">
            <Nombre valeur={etat.introuvables} />
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-encre-3">En erreur</dt>
          <dd
            className={`donnee mt-1 text-sm ${
              etat.erreurs > 0 ? "text-alerte" : "text-encre"
            }`}
          >
            <Nombre valeur={etat.erreurs} />
          </dd>
        </div>
      </dl>

      <form action={envoyer} className="mt-5 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enCours} className={action}>
          {enCours ? "Localisation en cours…" : "Localiser les centres manquants"}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-encre-2">
          <input
            type="checkbox"
            name="reprendreEchecs"
            value="1"
            className="h-4 w-4 accent-[var(--encre)]"
          />
          Reprendre aussi les adresses non reconnues
        </label>
      </form>

      <p className="mt-3 text-[13px] text-encre-3">
        Par lots de cinquante, à une requête par seconde — la cadence
        qu&apos;impose la politique d&apos;usage de Nominatim. Compter une
        minute par lot, et relancer tant qu&apos;il reste des centres :{" "}
        {reste > 0 ? (
          <>
            il en reste <span className="donnee text-encre">{reste}</span>.
          </>
        ) : (
          "il n'en reste aucun."
        )}
      </p>

      {retour.statut !== "vide" && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            retour.statut === "erreur" ? "text-erreur" : "text-vif"
          }`}
        >
          {retour.message}
          {retour.detail && (
            <span className="mt-1 block text-[13px] text-encre-3">
              {retour.detail}
            </span>
          )}
        </p>
      )}

      <p className="mt-4 border-t border-trait pt-3 text-[13px] text-encre-3">
        Cache de géocodage : <span className="donnee text-encre-2">
          {cache.total}
        </span>{" "}
        requête(s) mémorisée(s) — <span className="donnee">{cache.trouves}</span>{" "}
        résolue(s) et <span className="donnee">{cache.echecs}</span>{" "}
        sans résultat. Chacune est un appel réseau que le site n&apos;a plus à
        refaire, y compris les échecs : sans eux, une adresse mal saisie
        repartirait sur le réseau à chaque affichage.
      </p>
    </div>
  );
}
