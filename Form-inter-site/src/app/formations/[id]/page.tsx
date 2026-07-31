import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { debutDuJour, formatDateLong, formatDuree } from "@/lib/dates";
import { BACKEND } from "@/lib/backend/types";
import { Reglure } from "@/components/Reglure";
import { FlecheSortante } from "@/components/Marques";
import { TableauSessions } from "@/components/TableauSessions";
import { cadre, lien } from "@/lib/ui";

export const dynamic = "force-dynamic";

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
    description: `${formation.intitule}, chez ${formation.organisme.nom}. Dates, lieux et tarifs des sessions inter-entreprises.`,
  };
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
        className="w-fit text-sm text-encre-3 transition-colors hover:text-encre"
      >
        Retour au calendrier
      </Link>

      <div className={`${cadre} p-6`}>
        <h1 className="signature text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] text-encre">
          {formation.intitule}
        </h1>

        <p className="mt-2.5 text-sm text-encre-2">
          Proposée par{" "}
          <Link
            href={`/organismes/${formation.organisme.id}`}
            className={lien}
          >
            {formation.organisme.nom}
          </Link>
          {domaine && <span className="text-encre-3"> / {domaine}</span>}
          {formation.typeFormation && (
            <span className="text-encre-3"> / {formation.typeFormation}</span>
          )}
        </p>

        {/* Le même repère que sur la carte, à l'échelle de la fiche. */}
        <div className="mt-5">
          <Reglure
            sessions={formation.sessions}
            hauteur={130}
            libelles
            tailleLibelle={22}
          />
        </div>

        {formation.description && (
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-encre-2">
            {formation.description}
          </p>
        )}

        {/* Les repères qu'on cherche en premier sur une fiche : combien de
            temps, combien de dates, où, à quel prix. */}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-trait pt-5 sm:grid-cols-4">
          {formation.dureeValeur !== null && (
            <div>
              <dt className="text-[13px] text-encre-3">
                Durée
              </dt>
              <dd className="donnee mt-1 text-sm font-medium">
                {formatDuree(formation.dureeValeur, formation.dureeUnite)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[13px] text-encre-3">
              Sessions à venir
            </dt>
            <dd className="donnee mt-1 text-sm font-medium">
              {upcoming.length + permanentes.length}
            </dd>
          </div>
          {villes.length > 0 && (
            <div>
              <dt className="text-[13px] text-encre-3">
                Lieux
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {villes.length <= 2 ? villes.join(", ") : `${villes.length} villes`}
              </dd>
            </div>
          )}
          {derniereVue !== null && (
            <div>
              <dt className="text-[13px] text-encre-3">
                Relevé le
              </dt>
              <dd className="donnee mt-1 text-sm font-medium">
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
            className={`mt-4 inline-flex items-baseline gap-1.5 text-sm ${lien}`}
          >
            Programme de la formation
            <FlecheSortante />
          </a>
        )}
      </div>

      <section className={cadre}>
        <h2 className="signature border-b border-trait px-4 py-3 text-[17px] text-encre">
          Sessions à venir
        </h2>
        {upcoming.length === 0 && permanentes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-encre-3">
            Aucune session à venir n&apos;est planifiée pour cette formation.
          </p>
        ) : (
          <TableauSessions sessions={[...upcoming, ...permanentes]} />
        )}
      </section>

      {past.length > 0 && (
        <details className={`${cadre} group`}>
          <summary className="cursor-pointer px-4 py-3 text-sm text-encre-2 transition-colors hover:text-encre">
            <span className="donnee">{past.length}</span> session
            {past.length > 1 ? "s" : ""} passée{past.length > 1 ? "s" : ""}
          </summary>
          <div className="border-t border-trait">
            <TableauSessions sessions={past} passees />
          </div>
        </details>
      )}
    </div>
  );
}
