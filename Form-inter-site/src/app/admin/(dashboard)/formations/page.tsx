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
        className="grid grid-cols-1 gap-4 rounded-xl border border-bordure bg-surface shadow-carte p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          Ajouter une formation
        </h2>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Intitulé
          </label>
          <input
            name="intitule"
            required
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Organisme
          </label>
          <select
            name="organismeId"
            required
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
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
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Domaine
          </label>
          <select
            name="domaineId"
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
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
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Durée
          </label>
          <input
            name="dureeValeur"
            type="number"
            step="0.5"
            min="0"
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Unité
          </label>
          <select
            name="dureeUnite"
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          >
            <option value="jours">jours</option>
            <option value="heures">heures</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Description
          </label>
          <textarea
            name="description"
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 bg-action text-action-texte hover:bg-action-survol"
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
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure bg-surface px-4 py-3 text-sm hover:bg-surface-2"
          >
            <span className="font-medium">{f.intitule}</span>
            <span className="text-texte-doux">
              {f.organisme.nom}
              {f.domaine ? ` · ${f.domaine.nom}` : ""} · {f._count.sessions}{" "}
              session{f._count.sessions > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
        {formations.length === 0 && (
          <p className="text-sm text-texte-doux">Aucune formation pour le moment.</p>
        )}
      </div>
    </div>
  );
}
