import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BACKEND } from "@/lib/backend/types";
import { formatDateCourt, formatPeriode } from "@/lib/dates";
import {
  createSession,
  deleteFormation,
  deleteSession,
  updateFormation,
} from "../actions";

function SourceBadge({ source }: { source: string }) {
  const backend = source === BACKEND;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        backend
          ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
      title={
        backend
          ? "Synchronisée depuis le backend de veille"
          : "Saisie ou importée à la main"
      }
    >
      {backend ? "Backend" : "Manuel"}
    </span>
  );
}

export default async function AdminFormationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [formation, organismes, domaines] = await Promise.all([
    prisma.formation.findUnique({
      where: { id },
      include: {
        sessions: {
          include: { centre: true },
          orderBy: { dateDebut: { sort: "asc", nulls: "last" } },
        },
      },
    }),
    prisma.organisme.findMany({
      orderBy: { nom: "asc" },
      include: { centres: { orderBy: { ville: "asc" } } },
    }),
    prisma.domaine.findMany({ orderBy: { nom: "asc" } }),
  ]);

  if (!formation) notFound();

  const currentOrganisme = organismes.find(
    (o) => o.id === formation.organismeId
  );

  const updateFormationWithId = updateFormation.bind(null, id);
  const deleteFormationWithId = deleteFormation.bind(null, id);
  const createSessionForFormation = createSession.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {formation.intitule}
        </h1>
        <SourceBadge source={formation.source} />
      </div>

      {formation.source === BACKEND && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          Cette formation provient du backend de veille. Ses sessions
          synchronisées sont réécrites à chaque passage : pour une correction
          durable, passez par le back office du backend.
        </p>
      )}

      <form
        action={updateFormationWithId}
        className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">Informations</h2>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-500">
            Intitulé
          </label>
          <input
            name="intitule"
            required
            defaultValue={formation.intitule}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Organisme
          </label>
          <select
            name="organismeId"
            required
            defaultValue={formation.organismeId}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {organismes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Domaine
          </label>
          <select
            name="domaineId"
            defaultValue={formation.domaineId ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Aucun</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Durée
          </label>
          <input
            name="dureeValeur"
            type="number"
            step="0.5"
            min="0"
            defaultValue={formation.dureeValeur ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Unité
          </label>
          <select
            name="dureeUnite"
            defaultValue={formation.dureeUnite ?? "jours"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="jours">jours</option>
            <option value="heures">heures</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-500">
            Description
          </label>
          <textarea
            name="description"
            rows={4}
            defaultValue={formation.description ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Enregistrer
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Sessions</h2>

        <ul className="mt-3 flex flex-col gap-2">
          {formation.sessions.map((s) => {
            const deleteSessionAction = deleteSession.bind(null, id, s.id);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <SourceBadge source={s.source} />
                  {formatPeriode(s, formatDateCourt)}
                  {s.centre ? ` — ${s.centre.nom} (${s.centre.ville})` : ""}
                  {s.tarif && (
                    <span className="text-xs text-zinc-500">{s.tarif}</span>
                  )}
                  {s.placesInfo && (
                    <span className="text-xs text-zinc-500">{s.placesInfo}</span>
                  )}
                </span>
                <form action={deleteSessionAction}>
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </form>
              </li>
            );
          })}
          {formation.sessions.length === 0 && (
            <li className="text-sm text-zinc-500">Aucune session planifiée.</li>
          )}
        </ul>

        <form
          action={createSessionForFormation}
          className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Date de début
            </label>
            <input
              name="dateDebut"
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <input type="checkbox" name="permanente" />
              Entrée/sortie permanente (offre ouverte en continu, sans dates)
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Date de fin (optionnel)
            </label>
            <input
              name="dateFin"
              type="date"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Centre
            </label>
            <select
              name="centreId"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">À confirmer</option>
              {currentOrganisme?.centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({c.ville})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Places (optionnel)
            </label>
            <input
              name="placesInfo"
              placeholder="ex: 8 places restantes"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Tarif (optionnel)
            </label>
            <input
              name="tarif"
              placeholder="ex: 630 € HT / pers."
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Remarque (optionnel)
            </label>
            <input
              name="remarque"
              placeholder="ex: session ouverte toutes les semaines"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Ajouter la session
            </button>
          </div>
        </form>
      </div>

      <form action={deleteFormationWithId}>
        <button type="submit" className="text-sm text-red-600 hover:underline">
          Supprimer cette formation (et ses sessions)
        </button>
      </form>
    </div>
  );
}
