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
        className="grid grid-cols-1 gap-4 cadre p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">Informations</h2>
        <div>
          <label className="block text-[13px] text-encre-3">Nom</label>
          <input
            name="nom"
            required
            defaultValue={organisme.nom}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Site web
          </label>
          <input
            name="siteWeb"
            type="url"
            defaultValue={organisme.siteWeb ?? ""}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Téléphone
          </label>
          <input
            name="telephone"
            defaultValue={organisme.telephone ?? ""}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={organisme.email ?? ""}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-action px-4 py-2 text-sm font-medium text-action-texte transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </form>

      <div className="cadre p-4">
        <h2 className="text-sm font-semibold">Centres de formation</h2>

        <ul className="mt-3 flex flex-col gap-2">
          {organisme.centres.map((c) => {
            const deleteCentreAction = deleteCentre.bind(null, id, c.id);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-[var(--rayon)] border border-trait px-4 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{c.nom}</div>
                  <div className="text-encre-2">
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
            <li className="text-sm text-encre-2">Aucun centre pour le moment.</li>
          )}
        </ul>

        <form
          action={createCentreForOrganisme}
          className="mt-4 grid grid-cols-1 gap-3 border-t border-trait pt-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-[13px] text-encre-3">
              Nom du centre
            </label>
            <input
              name="nom"
              required
              placeholder={`${organisme.nom} - …`}
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Ville
            </label>
            <input
              name="ville"
              required
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Code postal
            </label>
            <input
              name="codePostal"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Adresse
            </label>
            <input
              name="adresse"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-surface-creuse px-4 py-2 text-sm font-medium text-encre transition-colors hover:bg-trait disabled:pointer-events-none disabled:opacity-40"
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
