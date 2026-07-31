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
      <h1 className="signature text-[26px] leading-tight text-encre">Organismes</h1>

      <form
        action={createOrganisme}
        className="grid grid-cols-1 gap-4 cadre p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-[13px] text-encre-3">
          Ajouter un organisme
        </h2>
        <div>
          <label className="block text-[13px] text-encre-3">Nom</label>
          <input
            name="nom"
            required
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
            placeholder="https://…"
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">
            Téléphone
          </label>
          <input
            name="telephone"
            className="mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]"
          />
        </div>
        <div>
          <label className="block text-[13px] text-encre-3">Email</label>
          <input
            name="email"
            type="email"
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
        {organismes.map((o) => (
          <Link
            key={o.id}
            href={`/admin/organismes/${o.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rayon)] border border-trait bg-surface px-4 py-3 text-sm hover:bg-surface-creuse"
          >
            <span className="font-medium">{o.nom}</span>
            <span className="text-encre-2">
              {o._count.centres} centre{o._count.centres > 1 ? "s" : ""} ·{" "}
              {o._count.formations} formation{o._count.formations > 1 ? "s" : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
