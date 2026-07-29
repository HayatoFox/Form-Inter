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
        className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          Ajouter un organisme
        </h2>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Nom</label>
          <input
            name="nom"
            required
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
            placeholder="https://…"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">
            Téléphone
          </label>
          <input
            name="telephone"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500">Email</label>
          <input
            name="email"
            type="email"
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
        {organismes.map((o) => (
          <Link
            key={o.id}
            href={`/admin/organismes/${o.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="font-medium">{o.nom}</span>
            <span className="text-zinc-500">
              {o._count.centres} centre{o._count.centres > 1 ? "s" : ""} ·{" "}
              {o._count.formations} formation{o._count.formations > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
