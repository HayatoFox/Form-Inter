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
        className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          Ajouter une formation
        </h2>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-500">
            Intitulé
          </label>
          <input
            name="intitule"
            required
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
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
          <label className="block text-xs font-medium text-zinc-500">
            Domaine
          </label>
          <select
            name="domaineId"
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
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Unité
          </label>
          <select
            name="dureeUnite"
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
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="font-medium">{f.intitule}</span>
            <span className="text-zinc-500">
              {f.organisme.nom}
              {f.domaine ? ` · ${f.domaine.nom}` : ""} · {f._count.sessions}{" "}
              session{f._count.sessions > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
        {formations.length === 0 && (
          <p className="text-sm text-zinc-500">Aucune formation pour le moment.</p>
        )}
      </div>
    </div>
  );
}
