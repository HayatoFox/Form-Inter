"use client";

import { useState } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { SessionsModal } from "@/components/SessionsModal";
import { Reglure } from "@/components/Reglure";
import { debutDuJour, formatDateCourt, formatDuree } from "@/lib/dates";

export type FormationWithRelations = Prisma.FormationGetPayload<{
  include: {
    organisme: true;
    domaine: true;
    sessions: { include: { centre: true } };
  };
}>;

export type SessionWithCentre = FormationWithRelations["sessions"][number];

// Les sessions à entrée permanente n'ont pas de date : elles passent après les
// sessions datées, dans l'ordre d'affichage comme dans le tri.
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

// L'unique endroit où une couleur signale quelque chose sur une carte : quand
// la place manque vraiment. Un ton brûlé, pas un accent saturé.
const TENDUE = /derni|complet|limit|places? restante/i;

export function FormationCard({
  formation,
  sessionsFiltered = false,
}: {
  formation: FormationWithRelations;
  sessionsFiltered?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);

  const sessions = trierSessions(formation.sessions);
  const aujourdhui = debutDuJour();
  const prochaine = sessionsFiltered
    ? sessions[0]
    : (sessions.find((s) => s.dateDebut && s.dateDebut >= aujourdhui) ??
      sessions.find((s) => !s.dateDebut));

  const duree = formatDuree(formation.dureeValeur, formation.dureeUnite);
  const tarif = prochaine?.tarif ?? sessions.find((s) => s.tarif)?.tarif ?? null;
  const tendue = prochaine?.placesInfo
    ? TENDUE.test(prochaine.placesInfo)
    : false;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        aria-haspopup="dialog"
        /* Pas d'élévation au survol, pas d'ombre : l'arête se raffermit et la
           surface se creuse d'un cran. Tonal, posé. */
        className="cadre group flex w-full flex-col gap-3 p-4 text-left transition-[box-shadow,background-color] duration-150 hover:bg-surface-creuse hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
      >
        <div>
          <h3 className="signature text-[17px] leading-[1.25] text-encre">
            {formation.intitule}
          </h3>
          {/* Plusieurs organismes proposent le même intitulé : « AIPR
              Concepteur » revient quatre fois d'affilée dans un tri
              alphabétique. L'organisme est le seul discriminant, il passe donc
              devant le domaine. */}
          <p className="mt-1 text-[13px]">
            <span className="text-encre-2">{formation.organisme.nom}</span>
            {formation.domaine && (
              <span className="text-encre-4"> / {formation.domaine.nom}</span>
            )}
          </p>
        </div>

        {/* La réglure : la question qu'on se pose devant un catalogue, c'est
            « ça tourne quand ? ». Elle y répond sans ouvrir la fiche. */}
        <Reglure sessions={sessions} hauteur={120} />

        {/* Le bloc de données est ancré en bas ET de hauteur fixe : trois
            lignes, toujours, même quand la troisième est vide. D'une carte à
            l'autre d'une même rangée, la date, le tarif, la ville et la durée
            tombent exactement sur les mêmes horizontales, quelle que soit la
            longueur de l'intitulé au-dessus ou la présence d'une alerte en
            dessous. Une grille de cartes qui se compare doit s'aligner.

            Pas de filet ici : le socle de la réglure juste au-dessus est déjà
            la ligne, en tracer une seconde à dix pixels serait de la structure
            décorative. */}
        <div className="mt-auto text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            {prochaine ? (
              <span className="donnee truncate text-encre">
                {prochaine.dateDebut
                  ? formatDateCourt(prochaine.dateDebut)
                  : "entrée permanente"}
              </span>
            ) : (
              <span className="text-encre-4">aucune date</span>
            )}
            {tarif && (
              <span className="donnee shrink-0 text-encre">{tarif}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-encre-2">
              {prochaine?.centre?.ville ?? "lieu à confirmer"}
            </span>
            {duree && (
              <span className="donnee shrink-0 text-encre-4">{duree}</span>
            )}
          </div>
          <p className="mt-1 min-h-[1.15rem] text-alerte">
            {tendue ? prochaine?.placesInfo : ""}
          </p>
        </div>
      </button>

      {ouverte && (
        <SessionsModal
          formation={formation}
          sessions={sessions}
          filtered={sessionsFiltered}
          onClose={() => setOuverte(false)}
        />
      )}
    </>
  );
}
