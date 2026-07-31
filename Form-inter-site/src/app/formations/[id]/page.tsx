import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  debutDuJour,
  formatDateLong,
  formatDuree,
  formatPeriode,
} from "@/lib/dates";
import { BACKEND } from "@/lib/backend/types";
import { Pastille } from "@/components/ui/Pastille";
import { styleDomaine } from "@/lib/domaines";
import { carte } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TENDUE = /derni|complet|limit|places? restante/i;

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const formation = await prisma.formation.findUnique({
    where: { id },
    select: { intitule: true, organisme: { select: { nom: true } } },
  });
  if (!formation) return { title: "Formation introuvable" };
  return {
    title: formation.intitule,
    description: `${formation.intitule} — ${formation.organisme.nom}. Dates, lieux et tarifs des sessions inter-entreprises.`,
  };
}

function LigneSession({
  session,
  passee = false,
}: {
  session: SessionAffichee;
  passee?: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors hover:bg-surface-2 ${
        passee ? "text-texte-tenu" : ""
      }`}
    >
      <span
        className={`chiffres min-w-[14rem] ${passee ? "" : "font-medium text-texte"}`}
      >
        {formatPeriode(session)}
      </span>
      <span className={`flex-1 ${passee ? "" : "text-texte-doux"}`}>
        {session.centre
          ? `${session.centre.nom} — ${session.centre.ville}`
          : "Lieu à confirmer"}
      </span>
      {session.dureeJours !== null && (
        <span className="chiffres text-xs text-texte-tenu">
          {session.dureeJours} j
        </span>
      )}
      {session.tarif && (
        <span
          className={`chiffres text-xs ${passee ? "" : "font-medium text-texte"}`}
        >
          {session.tarif}
        </span>
      )}
      {session.placesInfo && (
        <span
          className={`w-full text-xs sm:w-auto ${
            !passee && TENDUE.test(session.placesInfo)
              ? "font-medium text-accent"
              : "text-texte-tenu"
          }`}
        >
          {session.placesInfo}
        </span>
      )}
      {session.remarque && (
        <span className="w-full text-xs text-texte-tenu italic">
          {session.remarque}
        </span>
      )}
      {session.sourceUrl && (
        <a
          href={session.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-marque underline-offset-2 hover:underline"
        >
          Voir chez l&apos;organisme ↗
        </a>
      )}
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

  const domaine = formation.domaine?.nom ?? null;
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

  const villes = [
    ...new Set(formation.sessions.map((s) => s.centre?.ville).filter(Boolean)),
  ] as string[];

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link
        href="/formations"
        className="w-fit text-sm text-texte-doux underline-offset-2 transition-colors hover:text-texte hover:underline"
      >
        ← Retour aux formations
      </Link>

      <div
        style={styleDomaine(domaine)}
        className={`${carte} liseret-domaine p-6 pl-7`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight">
            {formation.intitule}
          </h1>
          <Pastille domaine={domaine} className="mt-1" />
        </div>

        <p className="mt-2 text-sm text-texte-doux">
          Proposée par{" "}
          <Link
            href={`/organismes/${formation.organisme.id}`}
            className="font-medium text-marque underline-offset-2 hover:underline"
          >
            {formation.organisme.nom}
          </Link>
          {formation.typeFormation && (
            <span className="text-texte-tenu"> · {formation.typeFormation}</span>
          )}
        </p>

        {formation.description && (
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-texte-doux">
            {formation.description}
          </p>
        )}

        {/* Les repères qu'on cherche en premier sur une fiche : combien de
            temps, combien de dates, où, à quel prix. */}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-bordure pt-5 sm:grid-cols-4">
          {formation.dureeValeur !== null && (
            <div>
              <dt className="text-xs tracking-wide text-texte-tenu uppercase">
                Durée
              </dt>
              <dd className="chiffres mt-1 text-sm font-medium">
                {formatDuree(formation.dureeValeur, formation.dureeUnite)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs tracking-wide text-texte-tenu uppercase">
              Sessions à venir
            </dt>
            <dd className="chiffres mt-1 text-sm font-medium">
              {upcoming.length + permanentes.length}
            </dd>
          </div>
          {villes.length > 0 && (
            <div>
              <dt className="text-xs tracking-wide text-texte-tenu uppercase">
                Lieux
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {villes.length <= 2 ? villes.join(", ") : `${villes.length} villes`}
              </dd>
            </div>
          )}
          {derniereVue !== null && (
            <div>
              <dt className="text-xs tracking-wide text-texte-tenu uppercase">
                Relevé le
              </dt>
              <dd className="chiffres mt-1 text-sm font-medium">
                {formatDateLong(new Date(derniereVue))}
              </dd>
            </div>
          )}
        </dl>

        {formation.urlProgramme && (
          <a
            href={formation.urlProgramme}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-marque underline-offset-2 hover:underline"
          >
            Programme de la formation ↗
          </a>
        )}
      </div>

      <section className={carte}>
        <h2 className="border-b border-bordure px-4 py-3 text-sm font-semibold">
          Sessions à venir
        </h2>
        {upcoming.length === 0 && permanentes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-texte-tenu">
            Aucune session à venir n&apos;est planifiée pour cette formation.
          </p>
        ) : (
          <ul className="divide-y divide-bordure">
            {upcoming.map((s) => (
              <LigneSession key={s.id} session={s} />
            ))}
            {permanentes.map((s) => (
              <LigneSession key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details className={`${carte} group`}>
          <summary className="cursor-pointer px-4 py-3 text-sm text-texte-doux transition-colors hover:text-texte">
            <span className="chiffres">{past.length}</span> session
            {past.length > 1 ? "s" : ""} passée{past.length > 1 ? "s" : ""}
          </summary>
          <ul className="divide-y divide-bordure border-t border-bordure">
            {past.map((s) => (
              <LigneSession key={s.id} session={s} passee />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
