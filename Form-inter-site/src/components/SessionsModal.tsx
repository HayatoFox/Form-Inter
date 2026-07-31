"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Pastille } from "@/components/ui/Pastille";
import type { FormationWithRelations } from "@/components/FormationCard";
import { formatDateCourt, formatDuree, formatPeriode } from "@/lib/dates";
import { boutonSecondaire } from "@/lib/ui";

const TENDUE = /derni|complet|limit|places? restante/i;

export function SessionsModal({
  formation,
  sessions,
  filtered,
  onClose,
}: {
  formation: FormationWithRelations;
  sessions: FormationWithRelations["sessions"];
  filtered: boolean;
  onClose: () => void;
}) {
  const domaine = formation.domaine?.nom ?? null;

  return (
    <Modal onClose={onClose} title={formation.intitule}>
      {/* En-tête collant : dans une formation qui compte cinquante sessions,
          on veut garder l'intitulé sous les yeux en faisant défiler. */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-bordure bg-surface/95 px-5 py-4 backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-semibold tracking-tight text-texte">
            {formation.intitule}
          </h2>
          <p className="mt-1 text-sm text-texte-doux">
            {formation.organisme.nom}
            {formation.typeFormation && (
              <span className="text-texte-tenu"> · {formation.typeFormation}</span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pastille domaine={domaine} />
            {formation.dureeValeur !== null && (
              <span className="chiffres text-xs text-texte-doux">
                {formatDuree(formation.dureeValeur, formation.dureeUnite)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-texte-tenu transition-colors hover:bg-surface-2 hover:text-texte"
        >
          ✕
        </button>
      </div>

      <div className="px-5 py-4">
        {formation.description && (
          <p className="mb-4 text-sm leading-relaxed whitespace-pre-line text-texte-doux">
            {formation.description}
          </p>
        )}

        <h3 className="mb-2.5 text-xs font-medium tracking-wide text-texte-tenu uppercase">
          <span className="chiffres">{sessions.length}</span> session
          {sessions.length > 1 ? "s" : ""}{" "}
          {filtered ? "correspondant à la recherche" : "planifiée(s)"}
        </h3>

        {sessions.length === 0 ? (
          <p className="text-sm text-texte-tenu">
            Aucune session ne correspond aux filtres sélectionnés.
          </p>
        ) : (
          <ul className="divide-y divide-bordure overflow-hidden rounded-lg border border-bordure">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-surface px-3.5 py-2.5 text-sm transition-colors hover:bg-surface-2"
              >
                {/* Format court : une plage en toutes lettres (« 08 septembre
                    2026 → 09 septembre 2026 ») déborde et casse l'alignement
                    des colonnes sur une liste de cinquante dates. */}
                <span className="chiffres min-w-[11.5rem] font-medium text-texte">
                  {formatPeriode(s, formatDateCourt)}
                </span>
                <span className="flex-1 text-texte-doux">
                  {s.centre ? s.centre.ville : "Lieu à confirmer"}
                </span>
                {s.dureeJours !== null && (
                  <span className="chiffres text-xs text-texte-tenu">
                    {s.dureeJours} j
                  </span>
                )}
                {s.tarif && (
                  <span className="chiffres text-xs font-medium text-texte">
                    {s.tarif}
                  </span>
                )}
                {s.placesInfo && (
                  <span
                    className={`text-xs ${
                      TENDUE.test(s.placesInfo)
                        ? "font-medium text-accent"
                        : "text-texte-tenu"
                    }`}
                  >
                    {s.placesInfo}
                  </span>
                )}
                {/* Le lien vers la source est répété à chaque ligne : réduit à
                    sa flèche, il reste accessible sans saturer la liste. */}
                {(s.urlProgramme ?? s.sourceUrl) && (
                  <a
                    href={s.urlProgramme ?? s.sourceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Voir cette session chez l'organisme"
                    className="text-xs text-texte-tenu transition-colors hover:text-marque"
                  >
                    <span className="sr-only">
                      Voir cette session chez l&apos;organisme
                    </span>
                    ↗
                  </a>
                )}
                {s.remarque && (
                  <span className="w-full text-xs text-texte-tenu italic">
                    {s.remarque}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-bordure bg-surface-2 px-5 py-3">
        {formation.urlProgramme ? (
          <a
            href={formation.urlProgramme}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-marque underline-offset-2 hover:underline"
          >
            Programme de la formation ↗
          </a>
        ) : (
          <span />
        )}
        <Link href={`/formations/${formation.id}`} className={boutonSecondaire}>
          Fiche complète →
        </Link>
      </div>
    </Modal>
  );
}
