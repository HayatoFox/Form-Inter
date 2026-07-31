import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createFormation } from "./actions";

export default async function AdminFormationsPage() {
  const [formations, organismes, domaines] = await Promise.all([
    prisma.formation.findMany({
      orderBy: { intitule: "asc" },
      include: {
        organisme: true,
        domaine: true,
        _count: { select: { sessions: true } },
      },
    }),
    prisma.organisme.findMany({ orderBy: { nom: "asc" } }),
    prisma.domaine.findMany({ orderBy: { nom: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Formations</h1>

      <form
        action={createFormation}
        className="grid grid-cols-1 gap-4 cadre p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          Ajouter une formation
        </h2>
        <div className="sm:col-span-2">
          <label className="block text-[13px] text-encre-3">
            Intitulé
          </label>
          <input
            name="intitule"
            required
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
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          >
            <option value="">Sélectionner…</option>
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
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Unité
          </label>
          <select
            name="dureeUnite"
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
            rows={3}
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-action px-4 py-2 text-sm font-medium text-action-texte transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {formations.map((f) => (
          <Link
            key={f.id}
            href={`/admin/formations/${f.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rayon)] border border-trait bg-surface px-4 py-3 text-sm hover:bg-surface-creuse"
          >
            <span className="font-medium">{f.intitule}</span>
            <span className="text-encre-2">
              {f.organisme.nom}
              {f.domaine ? ` · ${f.domaine.nom}` : ""} · {f._count.sessions}{" "}
              session{f._count.sessions > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
        {formations.length === 0 && (
          <p className="text-sm text-encre-2">Aucune formation pour le moment.</p>
        )}
      </div>
    </div>
  );
}
