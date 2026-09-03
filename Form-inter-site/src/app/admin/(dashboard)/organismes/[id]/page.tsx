import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createCentre,
  deleteCentre,
  deleteOrganisme,
  updateCentre,
  updateOrganisme,
} from "../actions";

const CHAMP =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const ETIQUETTE = "block text-xs font-medium text-zinc-500";

/** Où en est la localisation de ce centre, en clair. */
function etatGeo(centre: { geoStatut: string; latitude: number | null }) {
  if (centre.geoStatut === "ok" && centre.latitude !== null)
    return { texte: "Situé sur la carte", ton: "text-emerald-700 dark:text-emerald-400" };
  if (centre.geoStatut === "attente")
    return { texte: "À localiser au prochain passage", ton: "text-amber-700 dark:text-amber-400" };
  if (centre.geoStatut === "introuvable")
    return { texte: "Adresse non reconnue", ton: "text-red-700 dark:text-red-400" };
  return { texte: "Échec de localisation, sera repris", ton: "text-amber-700 dark:text-amber-400" };
}

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
          scrapers ne relèvent que la ville. La renseigner ici place le centre au
          bon endroit sur la carte — et modifier un lieu remet le centre en file
          de localisation, ses anciennes coordonnées désignant l&apos;ancienne
          adresse.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {organisme.centres.map((c) => {
            const deleteCentreAction = deleteCentre.bind(null, id, c.id);
            const updateCentreAction = updateCentre.bind(null, id, c.id);
            const geo = etatGeo(c);
            return (
              <li
                key={c.id}
                className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <form
                  action={updateCentreAction}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <div>
                    <label className={ETIQUETTE}>Nom du centre</label>
                    <input name="nom" required defaultValue={c.nom} className={CHAMP} />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Ville</label>
                    <input name="ville" required defaultValue={c.ville} className={CHAMP} />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Code postal</label>
                    <input
                      name="codePostal"
                      defaultValue={c.codePostal ?? ""}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Adresse</label>
                    <input
                      name="adresse"
                      defaultValue={c.adresse ?? ""}
                      placeholder="12 rue de la Paix"
                      className={CHAMP}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Enregistrer
                    </button>
                    <span className={`text-xs ${geo.ton}`}>{geo.texte}</span>
                    {c.geoLibelle && (
                      <span className="text-xs text-zinc-500">
                        Reconnu comme : {c.geoLibelle}
                      </span>
                    )}
                  </div>
                </form>
                <form action={deleteCentreAction} className="mt-2">
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Supprimer ce centre
                  </button>
                </form>
              </li>
            );
          })}
          {organisme.centres.length === 0 && (
            <li className="text-sm text-zinc-500">Aucun centre pour le moment.</li>
          )}
        </ul>

        <form
          action={createCentreForOrganisme}
          className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Nom du centre
            </label>
            <input
              name="nom"
              required
              placeholder={`${organisme.nom} — …`}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Ville
            </label>
            <input
              name="ville"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Code postal
            </label>
            <input
              name="codePostal"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Adresse
            </label>
            <input
              name="adresse"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Ajouter le centre
            </button>
          </div>
        </form>
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
