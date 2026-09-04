import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OrganismeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const organisme = await prisma.organisme.findUnique({
    where: { id },
    include: {
      centres: { orderBy: { ville: "asc" } },
      formations: {
        orderBy: { intitule: "asc" },
        include: { domaine: true },
      },
    },
  });

  if (!organisme) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/organismes" className="text-sm text-zinc-500 hover:underline">
          ← Retour aux organismes
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">{organisme.nom}</h1>
        <div className="mt-2 flex flex-col gap-1 text-sm text-zinc-500">
          {organisme.siteWeb && (
            <a
              href={organisme.siteWeb}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {organisme.siteWeb}
            </a>
          )}
          {organisme.telephone && <span>{organisme.telephone}</span>}
          {organisme.email && <span>{organisme.email}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Centres de formation</h2>
        {organisme.centres.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucun centre renseigné pour le moment.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {organisme.centres.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
              >
                <div className="font-medium">{c.nom}</div>
                {c.adresse && (
                  <div className="text-zinc-600 dark:text-zinc-400">{c.adresse}</div>
                )}
                <div className="text-zinc-500">
                  {c.codePostal ? `${c.codePostal} ` : ""}
                  {c.ville}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Formations dispensées</h2>
        {organisme.formations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucune formation renseignée pour le moment.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {organisme.formations.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/formations/${f.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{f.intitule}</span>
                  {f.domaine && (
                    <span className="text-zinc-500">{f.domaine.nom}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
