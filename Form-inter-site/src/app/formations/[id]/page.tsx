import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { debutDuJour, formatDateLong, formatPeriode } from "@/lib/dates";
import { BACKEND } from "@/lib/backend/types";

export const dynamic = "force-dynamic";

type SessionAffichee = {
  id: string;
  dateDebut: Date | null;
  dateFin: Date | null;
  dureeJours: number | null;
  tarif: string | null;
  remarque: string | null;
  placesInfo: string | null;
  urlProgramme: string | null;
  sourceUrl: string | null;
  centre: { nom: string; ville: string } | null;
};

function LigneSession({
  session,
  passee = false,
}: {
  session: SessionAffichee;
  passee?: boolean;
}) {
  return (
    <li
      className={`rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800 ${
        passee ? "text-zinc-500" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={passee ? "" : "font-medium"}>
          {formatPeriode(session)}
        </span>
        <span className="text-zinc-500">
          {session.centre
            ? `${session.centre.nom} — ${session.centre.ville}`
            : "Lieu à confirmer"}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {session.dureeJours !== null && (
          <span>
            {session.dureeJours} jour{session.dureeJours > 1 ? "s" : ""}
          </span>
        )}
        {session.tarif && <span>{session.tarif}</span>}
        {session.placesInfo && <span>{session.placesInfo}</span>}
        {session.remarque && <span>{session.remarque}</span>}
        {session.sourceUrl && (
          <a
            href={session.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Voir sur le site de l&apos;organisme ↗
          </a>
        )}
      </div>
    </li>
  );
}

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
        orderBy: { dateDebut: { sort: "asc", nulls: "last" } },
      },
    },
  });

  if (!formation) notFound();

  const aujourdhui = debutDuJour();
  const permanentes = formation.sessions.filter((s) => !s.dateDebut);
  const datees = formation.sessions.filter((s) => s.dateDebut !== null);
  const upcoming = datees.filter((s) => (s.dateFin ?? s.dateDebut!) >= aujourdhui);
  const past = datees.filter((s) => (s.dateFin ?? s.dateDebut!) < aujourdhui);

  // Date du dernier scrape où l'organisme publiait encore cette formation.
  const derniereVue = formation.sessions
    .filter((s) => s.source === BACKEND && s.lastSeen)
    .map((s) => s.lastSeen!.getTime())
    .reduce<number | null>((max, t) => (max === null || t > max ? t : max), null);

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
          {formation.typeFormation && ` · ${formation.typeFormation}`}
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

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {formation.urlProgramme && (
            <a
              href={formation.urlProgramme}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Programme de la formation ↗
            </a>
          )}
          {derniereVue !== null && (
            <span className="text-xs text-zinc-500">
              Relevé chez l&apos;organisme le {formatDateLong(new Date(derniereVue))}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Sessions à venir</h2>
        {upcoming.length === 0 && permanentes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucune session à venir n&apos;est planifiée pour cette formation.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {upcoming.map((s) => (
              <LigneSession key={s.id} session={s} />
            ))}
            {permanentes.map((s) => (
              <LigneSession key={s.id} session={s} />
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
                <LigneSession key={s.id} session={s} passee />
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
