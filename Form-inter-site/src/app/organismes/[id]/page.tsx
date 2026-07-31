import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FlecheSortante } from "@/components/Marques";
import { cadre, lien } from "@/lib/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const organisme = await prisma.organisme.findUnique({
    where: { id },
    select: { nom: true },
  });
  return organisme
    ? {
        title: organisme.nom,
        description: `Catalogue des formations inter-entreprises de ${organisme.nom} : centres, dates et sessions.`,
      }
    : { title: "Organisme introuvable" };
}

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
        include: { domaine: true, _count: { select: { sessions: true } } },
      },
    },
  });

  if (!organisme) notFound();

  const coordonnees = [organisme.telephone, organisme.email].filter(Boolean);

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link
        href="/organismes"
        className="w-fit text-sm text-encre-3 transition-colors hover:text-encre"
      >
        Retour aux organismes
      </Link>

      <div className={`${cadre} p-6`}>
        <h1 className="signature text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] text-encre">{organisme.nom}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-encre-2">
          {organisme.siteWeb && (
            <a
              href={organisme.siteWeb}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-baseline gap-1.5 ${lien}`}
            >
              {organisme.siteWeb.replace(/^https?:\/\//, "").replace(/\/+$/, "")}
              <FlecheSortante />
            </a>
          )}
          {coordonnees.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-trait pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-[13px] text-encre-3">
              Formations
            </dt>
            <dd className="donnee mt-1 text-sm font-medium">
              {organisme.formations.length}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-encre-3">
              Centres
            </dt>
            <dd className="donnee mt-1 text-sm font-medium">
              {organisme.centres.length}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-encre-3">
              Sessions
            </dt>
            <dd className="donnee mt-1 text-sm font-medium">
              {organisme.formations.reduce((n, f) => n + f._count.sessions, 0)}
            </dd>
          </div>
        </dl>

        {organisme.formations.length > 0 && (
          <Link
            href={`/formations?f=1&permanentes=1&organisme=${organisme.id}`}
            className={`mt-4 inline-block text-sm ${lien}`}
          >
            Filtrer le calendrier sur cet organisme
          </Link>
        )}
      </div>

      <section className={cadre}>
        <h2 className="signature border-b border-trait px-4 py-3 text-[17px] text-encre">
          Centres de formation
        </h2>
        {organisme.centres.length === 0 ? (
          <p className="px-4 py-6 text-sm text-encre-3">
            Aucun centre renseigné pour le moment.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-6 gap-y-2 p-4 text-sm">
            {organisme.centres.map((c) => (
              <li key={c.id}>
                <span className="text-encre">{c.ville}</span>
                {c.codePostal && (
                  <span className="donnee text-encre-4"> {c.codePostal}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cadre}>
        <h2 className="signature border-b border-trait px-4 py-3 text-[17px] text-encre">
          Formations dispensées
        </h2>
        {organisme.formations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-encre-3">
            Aucune formation renseignée pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-trait">
            {organisme.formations.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/formations/${f.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 text-sm transition-colors hover:bg-surface-creuse"
                >
                  <span className="font-medium">{f.intitule}</span>
                  <span className="flex items-center gap-3">
                    <span className="donnee text-xs text-encre-3">
                      {f._count.sessions} session{f._count.sessions > 1 ? "s" : ""}
                    </span>
                    {f.domaine && (
                      <span className="text-[13px] text-encre-3">
                        {f.domaine.nom}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
