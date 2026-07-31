import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createCentre,
  deleteCentre,
  deleteOrganisme,
  updateOrganisme,
} from "../actions";

export default async function AdminOrganismeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const organisme = await prisma.organisme.findUnique({
    where: { id },
    include: { centres: { orderBy: { ville: "asc" } } },
  });

  if (!organisme) notFound();

  const updateOrganismeWithId = updateOrganisme.bind(null, id);
  const deleteOrganismeWithId = deleteOrganisme.bind(null, id);
  const createCentreForOrganisme = createCentre.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{organisme.nom}</h1>

      <form
        action={updateOrganismeWithId}
        className="grid grid-cols-1 gap-4 rounded-xl border border-bordure bg-surface shadow-carte p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">Informations</h2>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">Nom</label>
          <input
            name="nom"
            required
            defaultValue={organisme.nom}
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Site web
          </label>
          <input
            name="siteWeb"
            type="url"
            defaultValue={organisme.siteWeb ?? ""}
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Téléphone
          </label>
          <input
            name="telephone"
            defaultValue={organisme.telephone ?? ""}
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={organisme.email ?? ""}
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 bg-action text-action-texte hover:bg-action-survol"
          >
            Enregistrer
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-bordure bg-surface shadow-carte p-4">
        <h2 className="text-sm font-semibold">Centres de formation</h2>

        <ul className="mt-3 flex flex-col gap-2">
          {organisme.centres.map((c) => {
            const deleteCentreAction = deleteCentre.bind(null, id, c.id);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-bordure px-4 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{c.nom}</div>
                  <div className="text-texte-doux">
                    {c.ville}
                    {c.codePostal ? ` (${c.codePostal})` : ""}
                  </div>
                </div>
                <form action={deleteCentreAction}>
                  <button
                    type="submit"
                    className="text-xs text-erreur hover:underline"
                  >
                    Supprimer
                  </button>
                </form>
              </li>
            );
          })}
          {organisme.centres.length === 0 && (
            <li className="text-sm text-texte-doux">Aucun centre pour le moment.</li>
          )}
        </ul>

        <form
          action={createCentreForOrganisme}
          className="mt-4 grid grid-cols-1 gap-3 border-t border-bordure pt-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
              Nom du centre
            </label>
            <input
              name="nom"
              required
              placeholder={`${organisme.nom} — …`}
              className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
              Ville
            </label>
            <input
              name="ville"
              required
              className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
              Code postal
            </label>
            <input
              name="codePostal"
              className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
              Adresse
            </label>
            <input
              name="adresse"
              className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 border border-bordure-forte bg-surface text-texte hover:bg-surface-2"
            >
              Ajouter le centre
            </button>
          </div>
        </form>
      </div>

      <form action={deleteOrganismeWithId}>
        <button
          type="submit"
          className="text-sm text-erreur hover:underline"
        >
          Supprimer cet organisme (et ses centres/formations)
        </button>
      </form>
    </div>
  );
}
