import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Pastille } from "@/components/ui/Pastille";
import { carte } from "@/lib/ui";

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
        className="w-fit text-sm text-texte-doux underline-offset-2 transition-colors hover:text-texte hover:underline"
      >
        ← Retour aux organismes
      </Link>

      <div className={`${carte} p-6`}>
        <h1 className="text-2xl font-semibold tracking-tight">{organisme.nom}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-texte-doux">
          {organisme.siteWeb && (
            <a
              href={organisme.siteWeb}
              target="_blank"
              rel="noopener noreferrer"
              className="text-marque underline-offset-2 hover:underline"
            >
              {organisme.siteWeb.replace(/^https?:\/\//, "").replace(/\/+$/, "")} ↗
            </a>
          )}
          {coordonnees.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-bordure pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs tracking-wide text-texte-tenu uppercase">
              Formations
            </dt>
            <dd className="chiffres mt-1 text-sm font-medium">
              {organisme.formations.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-texte-tenu uppercase">
              Centres
            </dt>
            <dd className="chiffres mt-1 text-sm font-medium">
              {organisme.centres.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-texte-tenu uppercase">
              Sessions
            </dt>
            <dd className="chiffres mt-1 text-sm font-medium">
              {organisme.formations.reduce((n, f) => n + f._count.sessions, 0)}
            </dd>
          </div>
        </dl>

        {organisme.formations.length > 0 && (
          <Link
            href={`/formations?f=1&permanentes=1&organisme=${organisme.id}`}
            className="mt-4 inline-block text-sm text-marque underline-offset-2 hover:underline"
          >
            Filtrer le catalogue sur cet organisme →
          </Link>
        )}
      </div>

      <section className={carte}>
        <h2 className="border-b border-bordure px-4 py-3 text-sm font-semibold">
          Centres de formation
        </h2>
        {organisme.centres.length === 0 ? (
          <p className="px-4 py-6 text-sm text-texte-tenu">
            Aucun centre renseigné pour le moment.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 p-4">
            {organisme.centres.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-bordure px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{c.ville}</span>
                {c.codePostal && (
                  <span className="chiffres text-texte-tenu"> {c.codePostal}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carte}>
        <h2 className="border-b border-bordure px-4 py-3 text-sm font-semibold">
          Formations dispensées
        </h2>
        {organisme.formations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-texte-tenu">
            Aucune formation renseignée pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-bordure">
            {organisme.formations.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/formations/${f.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
                >
                  <span className="font-medium">{f.intitule}</span>
                  <span className="flex items-center gap-3">
                    <span className="chiffres text-xs text-texte-tenu">
                      {f._count.sessions} session{f._count.sessions > 1 ? "s" : ""}
                    </span>
                    {f.domaine && <Pastille domaine={f.domaine.nom} />}
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
