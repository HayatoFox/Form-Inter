import { prisma } from "@/lib/prisma";
import { createDomaine, deleteDomaine, renameDomaine } from "./actions";
import { MergeDomaineButton } from "@/components/admin/MergeDomaineButton";

export default async function AdminDomainesPage() {
  const domaines = await prisma.domaine.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { formations: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Domaines</h1>

      <form
        action={createDomaine}
        className="flex flex-wrap items-end gap-3 cadre p-4"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[13px] text-encre-3">
            Nouveau domaine
          </label>
          <input
            name="nom"
            required
            placeholder="ex: Habilitation électrique"
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-action px-4 py-2 text-sm font-medium text-action-texte transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
        >
          Ajouter
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {domaines.map((d) => {
          const renameAction = renameDomaine.bind(null, d.id);
          const deleteAction = deleteDomaine.bind(null, d.id);
          const otherDomaines = domaines
            .filter((other) => other.id !== d.id)
            .map((other) => ({
              id: other.id,
              nom: other.nom,
              formationsCount: other._count.formations,
            }));
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rayon)] border border-trait bg-surface px-4 py-2"
            >
              <form action={renameAction} className="flex items-center gap-2">
                <input
                  name="nom"
                  defaultValue={d.nom}
                  className="rounded-[var(--rayon)] bg-surface px-2.5 py-1.5 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
                />
                <button
                  type="submit"
                  className="text-xs text-encre-2 hover:underline"
                >
                  Renommer
                </button>
              </form>
              <div className="flex items-center gap-3 text-sm text-encre-2">
                <span>
                  {d._count.formations} formation
                  {d._count.formations > 1 ? "s" : ""}
                </span>
                <MergeDomaineButton
                  domaine={{
                    id: d.id,
                    nom: d.nom,
                    formationsCount: d._count.formations,
                  }}
                  otherDomaines={otherDomaines}
                />
                <form action={deleteAction}>
                  <button
                    type="submit"
                    className="text-xs text-erreur hover:underline"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {domaines.length === 0 && (
          <li className="text-sm text-encre-2">Aucun domaine pour le moment.</li>
        )}
      </ul>
    </div>
  );
}
