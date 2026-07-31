"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialogue } from "@/components/ui/Dialogue";
import { actionDanger, actionDouce, champ, legende } from "@/lib/ui";
import { wipeAllData } from "@/app/admin/(dashboard)/actions";

const CONFIRM_WORD = "SUPPRIMER";

export function DangerZone({
  counts,
}: {
  counts: { organismes: number; formations: number; sessions: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  async function handleConfirm() {
    setLoading(true);
    await wipeAllData();
    setLoading(false);
    close();
    router.refresh();
  }

  return (
    /* Pas d'aplat rouge derrière le bloc entier : le danger est dans
       l'action, pas dans le paragraphe qui l'explique. C'est le bouton qui
       porte la couleur, et c'est le seul du site à le faire. */
    <div className="border-t border-trait pt-5">
      <h2 className="signature text-[17px] text-encre">Zone dangereuse</h2>
      <p className="mt-1 max-w-2xl text-sm text-encre-2">
        Supprime définitivement tous les organismes, centres, domaines,
        formations et sessions. Cette action est irréversible.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${actionDanger} mt-3`}
      >
        Supprimer toutes les données
      </button>

      <Dialogue
        ouvert={open}
        onFermer={close}
        titre="Supprimer toutes les données ?"
        description="Cette action est irréversible."
      >
          <p className="text-sm text-encre-2">
            Vous êtes sur le point de supprimer définitivement :
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-encre-2">
            <li>{counts.organismes} organisme(s) et leurs centres</li>
            <li>{counts.formations} formation(s)</li>
            <li>{counts.sessions} session(s)</li>
          </ul>
          <p className="mt-3 text-sm font-medium text-erreur">
            Cette action est irréversible.
          </p>
          <label className={`${legende} mt-4`}>
            Tapez {CONFIRM_WORD} pour confirmer
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className={`${champ} donnee mt-1.5`}
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className={actionDouce}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || loading}
              className={actionDanger}
            >
              {loading ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </Dialogue>
    </div>
  );
}
