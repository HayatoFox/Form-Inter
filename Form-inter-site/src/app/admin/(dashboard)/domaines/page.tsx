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
        className="flex flex-wrap items-end gap-3 rounded-xl border border-bordure bg-surface shadow-carte p-4"
      >
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Nouveau domaine
          </label>
          <input
            name="nom"
            required
            placeholder="ex: Habilitation électrique"
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 bg-action text-action-texte hover:bg-action-survol"
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface px-4 py-2"
            >
              <form action={renameAction} className="flex items-center gap-2">
                <input
                  name="nom"
                  defaultValue={d.nom}
                  className="rounded-lg border border-bordure bg-surface px-2.5 py-1.5 text-sm text-texte transition-colors hover:border-bordure-forte"
                />
                <button
                  type="submit"
                  className="text-xs text-texte-doux hover:underline"
                >
                  Renommer
                </button>
              </form>
              <div className="flex items-center gap-3 text-sm text-texte-doux">
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
          <li className="text-sm text-texte-doux">Aucun domaine pour le moment.</li>
        )}
      </ul>
    </div>
  );
}
