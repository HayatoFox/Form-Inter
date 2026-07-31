import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Nombre } from "@/components/Nombre";
import { cadre } from "@/lib/ui";

// La liste bouge à chaque synchronisation : rien à préparer au build — et il
// n'y a de toute façon pas de base à interroger au moment de construire
// l'image Docker.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organismes",
  description:
    "Les organismes de formation dont le catalogue inter-entreprises est suivi.",
};


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
        <h1 className="signature text-[26px] leading-tight text-encre">
          Organismes partenaires
        </h1>
        <p className="text-sm text-encre-2">
          <Nombre valeur={organismes.length} className="donnee font-medium text-encre" />{" "}
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
              /* Même réaction au survol que les cartes du calendrier : l'arête
                 se raffermit, la surface se creuse. Aucun soulèvement. */
              className={`${cadre} group flex flex-col gap-2 p-4 transition-[box-shadow,background-color] duration-150 hover:bg-surface-creuse hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]`}
            >
              <h2 className="signature text-[17px] leading-[1.25] text-encre transition-colors group-hover:text-vif">
                {o.nom}
              </h2>
              {o.siteWeb && (
                <p className="truncate text-sm text-encre-3">
                  {domaineLisible(o.siteWeb)}
                </p>
              )}
              <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-sm text-encre-2">
                <span>
                  <span className="donnee font-medium text-encre">
                    {o._count.formations}
                  </span>{" "}
                  formation{o._count.formations > 1 ? "s" : ""}
                </span>
                <span className="text-encre-3">·</span>
                <span>
                  <span className="donnee font-medium text-encre">
                    {o._count.centres}
                  </span>{" "}
                  centre{o._count.centres > 1 ? "s" : ""}
                </span>
              </p>
              {villes.length > 0 && (
                <p className="truncate text-xs text-encre-3">
                  {villes.slice(0, 4).join(" · ")}
                  {villes.length > 4 && ` · +${villes.length - 4}`}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {sansOffre.length > 0 && (
        <section className="border-t border-trait pt-4">
          <h2 className="text-[13px] text-encre-3">
            Sans catalogue relevé pour l&apos;instant
          </h2>
          {/* Une liste de noms, pas une rangée de pastilles bordées : ce sont
              des organismes, pas des étiquettes. */}
          <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
            {sansOffre.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/organismes/${o.id}`}
                  className="text-[15px] text-encre-2 transition-colors hover:text-vif"
                >
                  {o.nom}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
