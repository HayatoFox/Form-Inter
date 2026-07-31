"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import type { FormationWithRelations } from "@/components/FormationCard";
import { Reglure } from "@/components/Reglure";
import { TableauSessions } from "@/components/TableauSessions";
import { formatDuree } from "@/lib/dates";
import { lien } from "@/lib/ui";

/**
 * La liste des dates d'une formation.
 *
 * Le comportement (focus piégé et rendu, fermeture au clavier, verrouillage du
 * défilement, sémantique ARIA) vient de Radix plutôt que d'un piège à focus
 * écrit à la main : c'est une primitive éprouvée, il n'y a aucune raison d'en
 * réécrire une version moins bonne. Toute la direction artistique est posée
 * par-dessus.
 */
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
  const duree = formatDuree(formation.dureeValeur, formation.dureeUnite);

  return (
    <Dialog.Root open onOpenChange={(ouvert) => !ouvert && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--encre)_45%,transparent)]" />
        <Dialog.Content
          className="cadre fixed top-1/2 left-1/2 z-50 flex max-h-[86vh] w-[min(54rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-trait px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="signature text-[22px] leading-[1.2] text-encre">
                {formation.intitule}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-encre-3">
                {formation.organisme.nom}
                {formation.domaine && (
                  <>
                    <span className="text-encre-4"> / </span>
                    {formation.domaine.nom}
                  </>
                )}
                {duree && (
                  <>
                    <span className="text-encre-4"> / </span>
                    <span className="donnee">{duree}</span>
                  </>
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fermer"
              className="-mt-1 -mr-1 shrink-0 rounded-[3px] px-2 py-1 text-encre-3 transition-colors hover:text-encre"
            >
              Fermer
            </Dialog.Close>
          </div>

          {/* La même réglure qu'en carte, agrandie et légendée : on garde le
              repère qu'on avait sous les yeux avant d'ouvrir. */}
          <div className="border-b border-trait px-5 py-4">
            <Reglure
              sessions={sessions}
              hauteur={110}
              libelles
              tailleLibelle={24}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {formation.description && (
              <p className="border-b border-trait px-5 py-4 text-sm leading-relaxed whitespace-pre-line text-encre-2">
                {formation.description}
              </p>
            )}

            {sessions.length === 0 ? (
              <p className="px-5 py-8 text-sm text-encre-3">
                Aucune session ne correspond aux filtres sélectionnés.
              </p>
            ) : (
              <TableauSessions sessions={sessions} format="court" compact />
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-trait px-5 py-3 text-sm">
            <span className="text-encre-3">
              <span className="donnee text-encre">{sessions.length}</span>{" "}
              session{sessions.length > 1 ? "s" : ""}
              {filtered ? " correspondant à la recherche" : ""}
            </span>
            <Link href={`/formations/${formation.id}`} className={lien}>
              Fiche complète
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
