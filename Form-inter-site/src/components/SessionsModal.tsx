"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import type { FormationWithRelations } from "@/components/FormationCard";
import { formatPeriode } from "@/lib/dates";

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
  return (
    <Modal onClose={onClose} title={formation.intitule}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{formation.intitule}</h2>
          <p className="text-sm text-zinc-500">
            {formation.organisme.nom}
            {formation.typeFormation ? ` · ${formation.typeFormation}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
        >
          ✕
        </button>
      </div>

      {formation.description && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {formation.description}
        </p>
      )}

      {formation.urlProgramme && (
        <a
          href={formation.urlProgramme}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          Programme de la formation ↗
        </a>
      )}

      <h3 className="mt-5 text-sm font-semibold">
        {sessions.length} session{sessions.length > 1 ? "s" : ""}{" "}
        {filtered ? "correspondant à votre recherche" : "planifiée(s)"}
      </h3>

      {sessions.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          Aucune session ne correspond aux filtres sélectionnés.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{formatPeriode(s)}</span>
                <span className="text-zinc-500">
                  {s.centre
                    ? `${s.centre.nom} — ${s.centre.ville}`
                    : "Lieu à confirmer"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                {s.dureeJours !== null && (
                  <span>
                    {s.dureeJours} jour{s.dureeJours > 1 ? "s" : ""}
                  </span>
                )}
                {s.tarif && <span>{s.tarif}</span>}
                {s.placesInfo && <span>{s.placesInfo}</span>}
                {s.remarque && <span>{s.remarque}</span>}
                {s.urlProgramme && s.urlProgramme !== formation.urlProgramme && (
                  <a
                    href={s.urlProgramme}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Programme ↗
                  </a>
                )}
                {s.sourceUrl && (
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Voir sur le site de l&apos;organisme ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <Link
          href={`/formations/${formation.id}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Fiche complète et carte des centres →
        </Link>
      </div>
    </Modal>
  );
}
