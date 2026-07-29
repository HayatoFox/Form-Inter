"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import type { FormationWithRelations } from "@/components/FormationCard";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

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
          <p className="text-sm text-zinc-500">{formation.organisme.nom}</p>
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
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
            >
              <span className="font-medium">
                {dateFormatter.format(s.dateDebut)}
                {s.dateFin && s.dateFin.getTime() !== s.dateDebut.getTime()
                  ? ` → ${dateFormatter.format(s.dateFin)}`
                  : ""}
              </span>
              <span className="text-zinc-500">
                {s.centre
                  ? `${s.centre.nom} — ${s.centre.ville}`
                  : "Lieu à confirmer"}
              </span>
              {s.placesInfo && (
                <span className="text-zinc-500">{s.placesInfo}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex justify-end">
        <Link
          href={`/formations/${formation.id}`}
          className="text-sm text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Voir la fiche complète →
        </Link>
      </div>
    </Modal>
  );
}
