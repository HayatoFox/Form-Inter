"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { mergeDomaines } from "@/app/admin/(dashboard)/domaines/actions";

type Domaine = {
  id: string;
  nom: string;
  formationsCount: number;
};

export function MergeDomaineButton({
  domaine,
  otherDomaines,
}: {
  domaine: Domaine;
  otherDomaines: Domaine[];
}) {
  const [open, setOpen] = useState(false);
  const mergeAction = mergeDomaines.bind(null, domaine.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={otherDomaines.length === 0}
        className="text-xs text-zinc-500 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        title={
          otherDomaines.length === 0
            ? "Aucun autre domaine à fusionner"
            : undefined
        }
      >
        Fusionner
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} title={`Fusionner « ${domaine.nom} »`}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Fusionner « {domaine.nom} »
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>

          <form
            action={(formData) => {
              setOpen(false);
              return mergeAction(formData);
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <div>
              <p className="text-xs font-medium text-zinc-500">
                Fusionner avec
              </p>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                {otherDomaines.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        name="mergeWith"
                        value={d.id}
                        className="rounded border-zinc-300 dark:border-zinc-700"
                      />
                      {d.nom}
                      <span className="text-zinc-500">
                        ({d.formationsCount} formation
                        {d.formationsCount > 1 ? "s" : ""})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500">
                Nom final du domaine
              </label>
              <input
                name="finalName"
                required
                defaultValue={domaine.nom}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Toutes les formations des domaines sélectionnés seront
                rattachées à ce nom. Si ce nom correspond déjà à un domaine
                existant, la fusion se fait dans ce domaine-là.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Fusionner
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
