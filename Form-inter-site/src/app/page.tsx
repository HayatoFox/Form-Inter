import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Pastille } from "@/components/ui/Pastille";
import { debutDuJour } from "@/lib/dates";
import { boutonPrimaire, boutonSecondaire, carte, champ } from "@/lib/ui";

// Les compteurs et les domaines viennent de la base : la page suit le
// catalogue, elle n'est pas figée au build.
export const dynamic = "force-dynamic";

const nombre = new Intl.NumberFormat("fr-FR");

export default async function Home() {
  const aujourdhui = debutDuJour();
  const sessionsAVenir = {
    OR: [
      { dateDebut: null },
      { dateFin: { gte: aujourdhui } },
      { dateFin: null, dateDebut: { gte: aujourdhui } },
    ],
  };

  const [nbFormations, nbSessions, nbOrganismes, nbVilles, domaines] =
    await Promise.all([
      prisma.formation.count({ where: { sessions: { some: sessionsAVenir } } }),
      prisma.session.count({ where: sessionsAVenir }),
      prisma.organisme.count({ where: { formations: { some: {} } } }),
      prisma.centre
        .findMany({ select: { ville: true }, distinct: ["ville"] })
        .then((v) => v.length),
      prisma.domaine.findMany({
        orderBy: { nom: "asc" },
        include: { _count: { select: { formations: true } } },
      }),
    ]);

  const domainesPeuples = domaines
    .filter((d) => d._count.formations > 0)
    .sort((a, b) => b._count.formations - a._count.formations);

  const chiffres = [
    { valeur: nbSessions, libelle: "sessions à venir" },
    { valeur: nbFormations, libelle: "formations" },
    { valeur: nbOrganismes, libelle: "organismes" },
    { valeur: nbVilles, libelle: "villes" },
  ];

  return (
    <div className="flex flex-col gap-10 py-6">
      <section className="flex flex-col items-center gap-5 text-center">
        <h1 className="max-w-3xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
          Toutes les sessions inter-entreprises,{" "}
          <span className="text-marque">au même endroit</span>
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-texte-doux text-pretty">
          Le catalogue des organismes de formation partenaires, relevé chaque
          jour : domaine, ville, dates, durée et tarif.
        </p>

        {/* Chercher est l'action première : le champ est dans la page, pas
            derrière un bouton qui mène à un autre écran. */}
        <form
          method="get"
          action="/formations"
          className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
        >
          <input type="hidden" name="f" value="1" />
          <input type="hidden" name="permanentes" value="1" />
          <label htmlFor="q-accueil" className="sr-only">
            Rechercher une formation
          </label>
          <input
            id="q-accueil"
            name="q"
            type="search"
            placeholder="CACES, habilitation électrique, SST…"
            className={`${champ} h-11 flex-1 text-[15px]`}
          />
          <button type="submit" className={`${boutonPrimaire} h-11 px-6`}>
            Rechercher
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/formations" className={boutonSecondaire}>
            Parcourir le catalogue
          </Link>
          <Link href="/organismes" className={boutonSecondaire}>
            Voir les organismes
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chiffres.map((c) => (
          <div key={c.libelle} className={`${carte} px-4 py-3.5 text-center`}>
            <div className="chiffres text-2xl font-semibold tracking-tight">
              {nombre.format(c.valeur)}
            </div>
            <div className="mt-0.5 text-xs text-texte-doux">{c.libelle}</div>
          </div>
        ))}
      </section>

      {domainesPeuples.length > 0 && (
        <section className="flex flex-col items-center gap-4">
          <h2 className="text-xs font-medium tracking-wide text-texte-tenu uppercase">
            Entrer par domaine
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {domainesPeuples.map((d) => (
              <Link
                key={d.id}
                href={`/formations?f=1&permanentes=1&domaine=${d.id}`}
                className="transition-transform hover:-translate-y-px"
              >
                <Pastille domaine={d.nom} className="!py-1 !text-[13px]" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
