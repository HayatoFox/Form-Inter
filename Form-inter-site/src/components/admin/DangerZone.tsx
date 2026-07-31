"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
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
    <div className="rounded-lg border border-erreur/30 bg-erreur-fond p-6">
      <h2 className="text-sm font-semibold text-erreur">
        Zone dangereuse
      </h2>
      <p className="mt-1 text-sm text-erreur">
        Supprime définitivement tous les organismes, centres, domaines,
        formations et sessions. Cette action est irréversible.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md bg-erreur px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Supprimer toutes les données
      </button>

      {open && (
        <Modal onClose={close} title="Confirmer la suppression">
          <h3 className="text-lg font-semibold text-erreur">
            Supprimer toutes les données ?
          </h3>
          <p className="mt-2 text-sm text-texte-doux dark:text-texte-tenu">
            Vous êtes sur le point de supprimer définitivement :
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-texte-doux dark:text-texte-tenu">
            <li>{counts.organismes} organisme(s) et leurs centres</li>
            <li>{counts.formations} formation(s)</li>
            <li>{counts.sessions} session(s)</li>
          </ul>
          <p className="mt-3 text-sm font-medium text-erreur">
            Cette action est irréversible.
          </p>
          <label className="mt-4 block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Tapez {CONFIRM_WORD} pour confirmer
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 border border-bordure-forte bg-surface text-texte hover:bg-surface-2"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || loading}
              className="rounded-md bg-erreur px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
