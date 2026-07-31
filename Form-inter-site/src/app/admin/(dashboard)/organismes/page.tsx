import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createOrganisme } from "./actions";

export default async function AdminOrganismesPage() {
  const organismes = await prisma.organisme.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { centres: true, formations: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Organismes</h1>

      <form
        action={createOrganisme}
        className="grid grid-cols-1 gap-4 rounded-xl border border-bordure bg-surface shadow-carte p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          Ajouter un organisme
        </h2>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">Nom</label>
          <input
            name="nom"
            required
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
            placeholder="https://…"
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
            Téléphone
          </label>
          <input
            name="telephone"
            className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-wide text-texte-doux uppercase">Email</label>
          <input
            name="email"
            type="email"
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
        {organismes.map((o) => (
          <Link
            key={o.id}
            href={`/admin/organismes/${o.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure bg-surface px-4 py-3 text-sm hover:bg-surface-2"
          >
            <span className="font-medium">{o.nom}</span>
            <span className="text-texte-doux">
              {o._count.centres} centre{o._count.centres > 1 ? "s" : ""} ·{" "}
              {o._count.formations} formation{o._count.formations > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
