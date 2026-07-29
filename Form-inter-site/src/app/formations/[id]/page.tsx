import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function FormationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const formation = await prisma.formation.findUnique({
    where: { id },
    include: {
      organisme: true,
      domaine: true,
      sessions: {
        include: { centre: true },
        orderBy: { dateDebut: "asc" },
      },
    },
  });

  if (!formation) notFound();

  const now = new Date();
  const upcoming = formation.sessions.filter((s) => s.dateDebut >= now);
  const past = formation.sessions.filter((s) => s.dateDebut < now);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/formations" className="text-sm text-zinc-500 hover:underline">
          ← Retour aux formations
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {formation.intitule}
          </h1>
          {formation.domaine && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {formation.domaine.nom}
            </span>
          )}
        </div>

        <p className="mt-2 text-sm text-zinc-500">
          Proposée par{" "}
          <Link
            href={`/organismes/${formation.organisme.id}`}
            className="font-medium underline"
          >
            {formation.organisme.nom}
          </Link>
        </p>

        {formation.dureeValeur && (
          <p className="mt-1 text-sm text-zinc-500">
            Durée : {formation.dureeValeur} {formation.dureeUnite ?? ""}
          </p>
        )}

        {formation.description && (
          <p className="mt-4 whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {formation.description}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Sessions à venir</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucune session à venir n&apos;est planifiée pour cette formation.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {upcoming.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
              >
                <span className="font-medium">
                  {dateFormatter.format(s.dateDebut)}
                  {s.dateFin ? ` → ${dateFormatter.format(s.dateFin)}` : ""}
                </span>
                <span className="text-zinc-500">
                  {s.centre ? `${s.centre.nom} — ${s.centre.ville}` : "Lieu à confirmer"}
                </span>
                {s.placesInfo && (
                  <span className="text-zinc-500">{s.placesInfo}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-500">
              Sessions passées ({past.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-2">
              {past.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800"
                >
                  <span>{dateFormatter.format(s.dateDebut)}</span>
                  <span>
                    {s.centre ? `${s.centre.nom} — ${s.centre.ville}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
