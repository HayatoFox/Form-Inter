"use client";

import { useState } from "react";
import { Dialogue } from "@/components/ui/Dialogue";
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
        className="text-xs text-encre-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        title={
          otherDomaines.length === 0
            ? "Aucun autre domaine à fusionner"
            : undefined
        }
      >
        Fusionner
      </button>

      <Dialogue
        ouvert={open}
        onFermer={() => setOpen(false)}
        titre={`Fusionner « ${domaine.nom} »`}
      >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Fusionner « {domaine.nom} »
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="shrink-0 rounded-[var(--rayon)] p-1 text-encre-3 hover:bg-surface-creuse hover:text-encre"
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
              <p className="text-xs font-medium text-encre-2">
                Fusionner avec
              </p>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
                {otherDomaines.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-center gap-2 rounded-[var(--rayon)] px-2 py-1.5 text-sm hover:bg-surface-creuse">
                      <input
                        type="checkbox"
                        name="mergeWith"
                        value={d.id}
                        className="rounded border-trait-fort"
                      />
                      {d.nom}
                      <span className="text-encre-2">
                        ({d.formationsCount} formation
                        {d.formationsCount > 1 ? "s" : ""})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-[13px] text-encre-3">
                Nom final du domaine
              </label>
              <input
                name="finalName"
                required
                defaultValue={domaine.nom}
                className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
              />
              <p className="mt-1 text-xs text-encre-2">
                Toutes les formations des domaines sélectionnés seront
                rattachées à ce nom. Si ce nom correspond déjà à un domaine
                existant, la fusion se fait dans ce domaine-là.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-surface-creuse px-4 py-2 text-sm font-medium text-encre transition-colors hover:bg-trait disabled:pointer-events-none disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-action px-4 py-2 text-sm font-medium text-action-texte transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
              >
                Fusionner
              </button>
            </div>
          </form>
        </Dialogue>
    </>
  );
}
