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
        className="text-xs text-texte-doux hover:underline disabled:cursor-not-allowed disabled:opacity-40"
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
              className="shrink-0 rounded-md p-1 text-texte-tenu hover:bg-surface-2 hover:text-texte"
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
              <p className="text-xs font-medium text-texte-doux">
                Fusionner avec
              </p>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                {otherDomaines.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                      <input
                        type="checkbox"
                        name="mergeWith"
                        value={d.id}
                        className="rounded border-bordure-forte"
                      />
                      {d.nom}
                      <span className="text-texte-doux">
                        ({d.formationsCount} formation
                        {d.formationsCount > 1 ? "s" : ""})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
                Nom final du domaine
              </label>
              <input
                name="finalName"
                required
                defaultValue={domaine.nom}
                className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
              />
              <p className="mt-1 text-xs text-texte-doux">
                Toutes les formations des domaines sélectionnés seront
                rattachées à ce nom. Si ce nom correspond déjà à un domaine
                existant, la fusion se fait dans ce domaine-là.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 border border-bordure-forte bg-surface text-texte hover:bg-surface-2"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 bg-action text-action-texte hover:bg-action-survol"
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
