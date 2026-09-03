"use client";

import { useState } from "react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { SessionsModal } from "@/components/SessionsModal";
import { debutDuJour, formatDateCourt } from "@/lib/dates";

export type FormationWithRelations = Prisma.FormationGetPayload<{
  include: {
    organisme: true;
    domaine: true;
    sessions: { include: { centre: true } };
  };
}>;

export type SessionWithCentre = FormationWithRelations["sessions"][number];

function formatDuree(f: FormationWithRelations) {
  if (!f.dureeValeur) return null;
  const unite = f.dureeUnite ?? "";
  return `${f.dureeValeur} ${unite}`.trim();
}

// Les sessions à entrée/sortie permanente n'ont pas de date : elles passent
// après les sessions datées, dans l'ordre d'affichage comme dans le tri.
export function trierSessions(
  sessions: SessionWithCentre[]
): SessionWithCentre[] {
  return [...sessions].sort((a, b) => {
    if (!a.dateDebut && !b.dateDebut) return 0;
    if (!a.dateDebut) return 1;
    if (!b.dateDebut) return -1;
    return a.dateDebut.getTime() - b.dateDebut.getTime();
  });
}

export function FormationCard({
  formation,
  sessionsFiltered = false,
}: {
  formation: FormationWithRelations;
  sessionsFiltered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const duree = formatDuree(formation);

  const sortedSessions = trierSessions(formation.sessions);
  // Hors recherche filtrée, on ne met en avant que les sessions à venir ;
  // avec des filtres actifs, la session la plus proche du résultat suffit,
  // même passée, puisque l'utilisateur a explicitement ciblé cette période.
  const aujourdhui = debutDuJour();
  const previewSession = sessionsFiltered
    ? sortedSessions[0]
    : (sortedSessions.find((s) => s.dateDebut && s.dateDebut >= aujourdhui) ??
      sortedSessions.find((s) => !s.dateDebut));

  return (
    <>
      {/* Le cadre porte la bordure ; le bouton n'est plus que la zone haute.
          Il fallait séparer les deux pour poser sous lui un lien vers la fiche
          — un lien ne peut pas vivre à l'intérieur d'un bouton. */}
      <div className="rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full p-5 text-left"
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
                {!previewSession.dateDebut
                  ? "Entrée/sortie permanente"
                  : `${
                      sessionsFiltered ? "Session la plus proche" : "Prochaine session"
                    } : ${formatDateCourt(previewSession.dateDebut)}`}
                {previewSession.centre ? ` — ${previewSession.centre.ville}` : ""}
              </span>
            )}
            {previewSession?.tarif && <span>{previewSession.tarif}</span>}
            {!previewSession && sortedSessions.length === 0 && (
              <span>Aucune session planifiée</span>
            )}
          </div>
        </button>

        {/* La fiche n'était atteignable que par un petit lien au fond de la
            modale : la carte des centres, qui vit dessus, restait introuvable.
            Elle a droit à son propre chemin depuis le résultat de recherche. */}
        <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <Link
            href={`/formations/${formation.id}`}
            className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            Fiche complète et carte des centres →
          </Link>
        </div>
      </div>

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
