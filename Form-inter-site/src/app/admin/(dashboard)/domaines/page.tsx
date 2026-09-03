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
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-zinc-500">
            Nouveau domaine
          </label>
          <input
            name="nom"
            required
            placeholder="ex: Habilitation électrique"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <form action={renameAction} className="flex items-center gap-2">
                <input
                  name="nom"
                  defaultValue={d.nom}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  className="text-xs text-zinc-500 hover:underline"
                >
                  Renommer
                </button>
              </form>
              <div className="flex items-center gap-3 text-sm text-zinc-500">
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
                    className="text-xs text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {domaines.length === 0 && (
          <li className="text-sm text-zinc-500">Aucun domaine pour le moment.</li>
        )}
      </ul>
    </div>
  );
}
