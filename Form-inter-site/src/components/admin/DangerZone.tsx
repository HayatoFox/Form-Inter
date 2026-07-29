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
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
        Zone dangereuse
      </h2>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
        Supprime définitivement tous les organismes, centres, domaines,
        formations et sessions. Cette action est irréversible.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Supprimer toutes les données
      </button>

      {open && (
        <Modal onClose={close} title="Confirmer la suppression">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
            Supprimer toutes les données ?
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Vous êtes sur le point de supprimer définitivement :
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>{counts.organismes} organisme(s) et leurs centres</li>
            <li>{counts.formations} formation(s)</li>
            <li>{counts.sessions} session(s)</li>
          </ul>
          <p className="mt-3 text-sm font-medium text-red-600">
            Cette action est irréversible.
          </p>
          <label className="mt-4 block text-xs font-medium text-zinc-500">
            Tapez {CONFIRM_WORD} pour confirmer
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || loading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
