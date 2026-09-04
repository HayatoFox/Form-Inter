import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  CENTRE_NEUF,
  FormulaireCentre,
} from "@/components/admin/FormulaireCentre";
import {
  createCentre,
  deleteCentre,
  deleteOrganisme,
  updateCentre,
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
        className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">Informations</h2>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Nom</label>
          <input
            name="nom"
            required
            defaultValue={organisme.nom}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Site web
          </label>
          <input
            name="siteWeb"
            type="url"
            defaultValue={organisme.siteWeb ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Téléphone
          </label>
          <input
            name="telephone"
            defaultValue={organisme.telephone ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Email</label>
          <input
            name="email"
            type="email"
            defaultValue={organisme.email ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Enregistrer
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Centres de formation</h2>

        <p className="mt-1 text-xs text-zinc-500">
          L&apos;adresse de rue n&apos;arrive par aucun autre chemin : les
          scrapers ne relèvent que la ville. Choisir l&apos;adresse dans les
          suggestions pose le centre sur la carte dès l&apos;enregistrement.{" "}
          <Link href="/admin/centres" className="underline">
            Tous les centres sur un écran
          </Link>
          .
        </p>

        <ul className="mt-3 flex flex-col gap-3">
          {organisme.centres.map((c) => (
            <li key={c.id}>
              <FormulaireCentre
                centre={c}
                nomVerrouille={c.source === "BACKEND"}
                action={updateCentre.bind(null, id, c.id)}
                onSupprimer={deleteCentre.bind(null, id, c.id)}
              />
            </li>
          ))}
          {organisme.centres.length === 0 && (
            <li className="text-sm text-zinc-500">Aucun centre pour le moment.</li>
          )}
        </ul>

        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-medium text-zinc-500">
            Ajouter un centre
          </h3>
          <FormulaireCentre
            centre={CENTRE_NEUF}
            creation
            action={createCentreForOrganisme}
          />
        </div>
      </div>

      <form action={deleteOrganismeWithId}>
        <button
          type="submit"
          className="text-sm text-red-600 hover:underline"
        >
          Supprimer cet organisme (et ses centres/formations)
        </button>
      </form>
    </div>
  );
}
