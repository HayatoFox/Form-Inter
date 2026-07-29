import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function OrganismesPage() {
  const organismes = await prisma.organisme.findMany({
    orderBy: { nom: "asc" },
    include: {
      _count: { select: { centres: true, formations: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Organismes partenaires
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {organismes.length} organisme{organismes.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {organismes.map((o) => (
          <Link
            key={o.id}
            href={`/organismes/${o.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-base font-semibold">{o.nom}</h2>
            {o.siteWeb && (
              <p className="mt-1 truncate text-sm text-zinc-500">{o.siteWeb}</p>
            )}
            <div className="mt-3 flex gap-4 text-sm text-zinc-500">
              <span>
                {o._count.centres} centre{o._count.centres > 1 ? "s" : ""}
              </span>
              <span>
                {o._count.formations} formation
                {o._count.formations > 1 ? "s" : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
