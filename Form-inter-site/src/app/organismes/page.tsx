import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { carteInteractive } from "@/lib/ui";

// La liste bouge à chaque synchronisation : rien à préparer au build — et il
// n'y a de toute façon pas de base à interroger au moment de construire
// l'image Docker.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organismes",
  description:
    "Les organismes de formation dont le catalogue inter-entreprises est suivi.",
};

const nombre = new Intl.NumberFormat("fr-FR");

/** Retire le protocole et le slash final : un domaine se lit mieux qu'une URL. */
function domaineLisible(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export default async function OrganismesPage() {
  const organismes = await prisma.organisme.findMany({
    orderBy: { nom: "asc" },
    include: {
      _count: { select: { centres: true, formations: true } },
      centres: { select: { ville: true }, orderBy: { ville: "asc" } },
    },
  });

  const avecOffre = organismes.filter((o) => o._count.formations > 0);
  const sansOffre = organismes.filter((o) => o._count.formations === 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Organismes partenaires
        </h1>
        <p className="text-sm text-texte-doux">
          <span className="chiffres font-medium text-texte">
            {nombre.format(organismes.length)}
          </span>{" "}
          organisme{organismes.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {avecOffre.map((o) => {
          const villes = [...new Set(o.centres.map((c) => c.ville))];
          return (
            <Link
              key={o.id}
              href={`/organismes/${o.id}`}
              className={`${carteInteractive} group flex flex-col gap-2 p-4`}
            >
              <h2 className="text-[15px] font-semibold tracking-tight transition-colors group-hover:text-marque">
                {o.nom}
              </h2>
              {o.siteWeb && (
                <p className="truncate text-sm text-texte-tenu">
                  {domaineLisible(o.siteWeb)}
                </p>
              )}
              <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-sm text-texte-doux">
                <span>
                  <span className="chiffres font-medium text-texte">
                    {o._count.formations}
                  </span>{" "}
                  formation{o._count.formations > 1 ? "s" : ""}
                </span>
                <span className="text-texte-tenu">·</span>
                <span>
                  <span className="chiffres font-medium text-texte">
                    {o._count.centres}
                  </span>{" "}
                  centre{o._count.centres > 1 ? "s" : ""}
                </span>
              </p>
              {villes.length > 0 && (
                <p className="truncate text-xs text-texte-tenu">
                  {villes.slice(0, 4).join(" · ")}
                  {villes.length > 4 && ` · +${villes.length - 4}`}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {sansOffre.length > 0 && (
        <section className="border-t border-bordure pt-4">
          <h2 className="text-xs font-medium tracking-wide text-texte-tenu uppercase">
            Sans catalogue relevé pour l&apos;instant
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {sansOffre.map((o) => (
              <Link
                key={o.id}
                href={`/organismes/${o.id}`}
                className="rounded-lg border border-bordure px-3 py-1.5 text-sm text-texte-doux transition-colors hover:border-bordure-forte hover:text-texte"
              >
                {o.nom}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
