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
          ? "text-vif"
          : "bg-surface-creuse text-encre-2"
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
        <h1 className="signature text-[26px] leading-tight text-encre">
          {formation.intitule}
        </h1>
        <SourceBadge source={formation.source} />
      </div>

      {formation.source === BACKEND && (
        <p className="text-sm text-alerte">
          Cette formation provient du backend de veille. Ses sessions
          synchronisées sont réécrites à chaque passage : pour une correction
          durable, passez par le back office du backend.
        </p>
      )}

      <form
        action={updateFormationWithId}
        className="grid grid-cols-1 gap-4 cadre p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-[13px] text-encre-3">Informations</h2>
        <div className="sm:col-span-2">
          <label className="block text-[13px] text-encre-3">
            Intitulé
          </label>
          <input
            name="intitule"
            required
            defaultValue={formation.intitule}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Organisme
          </label>
          <select
            name="organismeId"
            required
            defaultValue={formation.organismeId}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          >
            {organismes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Domaine
          </label>
          <select
            name="domaineId"
            defaultValue={formation.domaineId ?? ""}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
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
          <label className="block text-[13px] text-encre-3">
            Durée
          </label>
          <input
            name="dureeValeur"
            type="number"
            step="0.5"
            min="0"
            defaultValue={formation.dureeValeur ?? ""}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Unité
          </label>
          <select
            name="dureeUnite"
            defaultValue={formation.dureeUnite ?? "jours"}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          >
            <option value="jours">jours</option>
            <option value="heures">heures</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[13px] text-encre-3">
            Description
          </label>
          <textarea
            name="description"
            rows={4}
            defaultValue={formation.description ?? ""}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-action px-4 py-2 text-sm font-medium text-action-texte transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </form>

      <div className="cadre p-4">
        <h2 className="text-[13px] text-encre-3">Sessions</h2>

        <ul className="mt-3 flex flex-col gap-2">
          {formation.sessions.map((s) => {
            const deleteSessionAction = deleteSession.bind(null, id, s.id);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rayon)] border border-trait px-4 py-2 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <SourceBadge source={s.source} />
                  {formatPeriode(s, formatDateCourt)}
                  {s.centre ? `, ${s.centre.nom} (${s.centre.ville})` : ""}
                  {s.tarif && (
                    <span className="text-xs text-encre-2">{s.tarif}</span>
                  )}
                  {s.placesInfo && (
                    <span className="text-xs text-encre-2">{s.placesInfo}</span>
                  )}
                </span>
                <form action={deleteSessionAction}>
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
          {formation.sessions.length === 0 && (
            <li className="text-sm text-encre-2">Aucune session planifiée.</li>
          )}
        </ul>

        <form
          action={createSessionForFormation}
          className="mt-4 grid grid-cols-1 gap-3 border-t border-trait pt-4 sm:grid-cols-2"
        >
          <div>
            <label className="block text-[13px] text-encre-3">
              Date de début
            </label>
            <input
              name="dateDebut"
              type="date"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-encre-2">
              <input type="checkbox" name="permanente" />
              Entrée/sortie permanente (offre ouverte en continu, sans dates)
            </label>
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Date de fin (optionnel)
            </label>
            <input
              name="dateFin"
              type="date"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Centre
            </label>
            <select
              name="centreId"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
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
            <label className="block text-[13px] text-encre-3">
              Places (optionnel)
            </label>
            <input
              name="placesInfo"
              placeholder="ex: 8 places restantes"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Tarif (optionnel)
            </label>
            <input
              name="tarif"
              placeholder="ex: 630 € HT / pers."
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div>
            <label className="block text-[13px] text-encre-3">
              Remarque (optionnel)
            </label>
            <input
              name="remarque"
              placeholder="ex: session ouverte toutes les semaines"
              className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-surface-creuse px-4 py-2 text-sm font-medium text-encre transition-colors hover:bg-trait disabled:pointer-events-none disabled:opacity-40"
            >
              Ajouter la session
            </button>
          </div>
        </form>
      </div>

      <form action={deleteFormationWithId}>
        <button type="submit" className="text-sm text-erreur hover:underline">
          Supprimer cette formation (et ses sessions)
        </button>
      </form>
    </div>
  );
}
