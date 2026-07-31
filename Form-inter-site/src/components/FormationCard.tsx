"use client";

import { useState } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { SessionsModal } from "@/components/SessionsModal";
import { Pastille } from "@/components/ui/Pastille";
import { styleDomaine } from "@/lib/domaines";
import { debutDuJour, formatDateCourt, formatDuree } from "@/lib/dates";
import { carteInteractive } from "@/lib/ui";

export type FormationWithRelations = Prisma.FormationGetPayload<{
  include: {
    organisme: true;
    domaine: true;
    sessions: { include: { centre: true } };
  };
}>;

export type SessionWithCentre = FormationWithRelations["sessions"][number];

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

// L'orange de marque est rare et signifiant : il ne sort que lorsque la
// disponibilité se tend. Le reste des mentions passe en gris.
const TENDUE = /derni|complet|limit|dispo.*restant|places? restante/i;

function Fait({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
    </span>
  );
}

export function FormationCard({
  formation,
  sessionsFiltered = false,
}: {
  formation: FormationWithRelations;
  sessionsFiltered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const duree = formatDuree(formation.dureeValeur, formation.dureeUnite);
  const domaine = formation.domaine?.nom ?? null;

  const sortedSessions = trierSessions(formation.sessions);
  // Hors recherche filtrée, on ne met en avant que les sessions à venir ; avec
  // des filtres actifs, la session la plus proche du résultat suffit, même
  // passée, puisque l'utilisateur a explicitement ciblé cette période.
  const aujourdhui = debutDuJour();
  const apercu = sessionsFiltered
    ? sortedSessions[0]
    : (sortedSessions.find((s) => s.dateDebut && s.dateDebut >= aujourdhui) ??
      sortedSessions.find((s) => !s.dateDebut));

  const tarif = apercu?.tarif ?? sortedSessions.find((s) => s.tarif)?.tarif ?? null;
  const dispoTendue = apercu?.placesInfo ? TENDUE.test(apercu.placesInfo) : false;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        style={styleDomaine(domaine)}
        className={`${carteInteractive} liseret-domaine group flex w-full flex-col gap-2.5 p-4 pl-5 text-left`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] leading-snug font-semibold tracking-tight text-texte transition-colors group-hover:text-marque">
            {formation.intitule}
          </h3>
          <Pastille domaine={domaine} className="mt-0.5 shrink-0" />
        </div>

        <p className="-mt-1 text-sm text-texte-doux">
          {formation.organisme.nom}
          {formation.typeFormation && (
            <span className="text-texte-tenu"> · {formation.typeFormation}</span>
          )}
        </p>

        {apercu ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <Fait className="font-medium text-texte">
              <span aria-hidden="true" className="text-texte-tenu">
                ▸
              </span>
              {apercu.dateDebut ? (
                <span className="chiffres">
                  {formatDateCourt(apercu.dateDebut)}
                </span>
              ) : (
                "Entrée permanente"
              )}
            </Fait>
            {apercu.centre && (
              <Fait className="text-texte-doux">{apercu.centre.ville}</Fait>
            )}
            {duree && (
              <Fait className="chiffres text-texte-doux">{duree}</Fait>
            )}
            {tarif && (
              <Fait className="chiffres ml-auto font-medium text-texte">
                {tarif}
              </Fait>
            )}
          </div>
        ) : (
          <p className="text-sm text-texte-tenu">Aucune session planifiée</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bordure pt-2.5 text-xs">
          <span className={dispoTendue ? "font-medium text-accent" : "text-texte-tenu"}>
            {apercu?.placesInfo ?? " "}
          </span>
          {sortedSessions.length > 0 && (
            <span className="font-medium text-texte-doux transition-colors group-hover:text-marque">
              <span className="chiffres">{sortedSessions.length}</span> session
              {sortedSessions.length > 1 ? "s" : ""}
              {sessionsFiltered ? " correspondantes" : ""}
              <span aria-hidden="true"> →</span>
            </span>
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
