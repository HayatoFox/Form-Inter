"use client";

import { useState } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { SessionsModal } from "@/components/SessionsModal";

export type FormationWithRelations = Prisma.FormationGetPayload<{
  include: {
    organisme: true;
    domaine: true;
    sessions: { include: { centre: true } };
  };
}>;

function formatDuree(f: FormationWithRelations) {
  if (!f.dureeValeur) return null;
  const unite = f.dureeUnite ?? "";
  return `${f.dureeValeur} ${unite}`.trim();
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function FormationCard({
  formation,
  sessionsFiltered = false,
}: {
  formation: FormationWithRelations;
  sessionsFiltered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const duree = formatDuree(formation);

  const sortedSessions = [...formation.sessions].sort(
    (a, b) => a.dateDebut.getTime() - b.dateDebut.getTime()
  );
  // Hors recherche filtrée, on ne met en avant que les sessions à venir ;
  // avec des filtres actifs, la session la plus proche du résultat suffit,
  // même passée, puisque l'utilisateur a explicitement ciblé cette période.
  const previewSession = sessionsFiltered
    ? sortedSessions[0]
    : sortedSessions.find((s) => s.dateDebut >= new Date());

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-lg border border-zinc-200 bg-white p-5 text-left transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{formation.intitule}</h3>
          {formation.domaine && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {formation.domaine.nom}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">{formation.organisme.nom}</p>
        {formation.description && (
          <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {formation.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
          {duree && <span>{duree}</span>}
          {sessionsFiltered && (
            <span>
              {sortedSessions.length} session
              {sortedSessions.length > 1 ? "s" : ""} correspondante
              {sortedSessions.length > 1 ? "s" : ""}
            </span>
          )}
          {previewSession && (
            <span>
              {sessionsFiltered ? "Session la plus proche" : "Prochaine session"}{" "}
              : {dateFormatter.format(previewSession.dateDebut)}
              {previewSession.centre ? ` — ${previewSession.centre.ville}` : ""}
            </span>
          )}
          {!previewSession && sortedSessions.length === 0 && (
            <span>Aucune session planifiée</span>
          )}
        </div>
      </button>

      {open && (
        <SessionsModal
          formation={formation}
          sessions={sortedSessions}
          filtered={sessionsFiltered}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
