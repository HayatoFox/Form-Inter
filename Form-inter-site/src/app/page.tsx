import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Reglure } from "@/components/Reglure";
import { Nombre } from "@/components/Nombre";
import { debutDuJour } from "@/lib/dates";
import { action, champ, lien } from "@/lib/ui";

// Les compteurs et la réglure viennent de la base : la page suit le catalogue,
// elle n'est pas figée au build.
export const dynamic = "force-dynamic";

export default async function Accueil() {
  const aujourdhui = debutDuJour();
  const aVenir = {
    OR: [
      { dateDebut: null },
      { dateFin: { gte: aujourdhui } },
      { dateFin: null, dateDebut: { gte: aujourdhui } },
    ],
  };

  const [sessions, nbFormations, nbOrganismes, nbVilles, domaines] =
    await Promise.all([
      prisma.session.findMany({
        where: aVenir,
        select: { dateDebut: true },
      }),
      prisma.formation.count({ where: { sessions: { some: aVenir } } }),
      prisma.organisme.count({ where: { formations: { some: {} } } }),
      prisma.centre
        .findMany({ select: { ville: true }, distinct: ["ville"] })
        .then((v) => v.length),
      prisma.domaine.findMany({
        orderBy: { nom: "asc" },
        include: { _count: { select: { formations: true } } },
      }),
    ]);

  const peuples = domaines
    .filter((d) => d._count.formations > 0)
    .sort((a, b) => b._count.formations - a._count.formations);

  // Une installation neuve n'a rien à montrer, et ce n'est pas une erreur : le
  // premier écran doit dire quoi faire, pas réciter des zéros. Une réglure
  // plate, une recherche sur rien et « 0 sessions à venir chez 0 organismes »
  // sont ce qu'on voit après un `npm install`.
  if (sessions.length === 0 && nbFormations === 0) {
    return (
      <div className="max-w-2xl py-6">
        <h1 className="signature text-[clamp(2.25rem,5.5vw,3.5rem)] leading-[1.02] text-encre">
          Le catalogue est vide
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-encre-2">
          Aucune session n&apos;a encore été relevée. Deux chemins la
          remplissent : la{" "}
          <Link href="/admin/sources" className={lien}>
            liaison avec le backend de veille
          </Link>
          , qui rapatrie ce que les scrapers collectent chaque nuit, et
          l&apos;import d&apos;un fichier Excel ou CSV fourni par un organisme.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-encre-3">
          Pour juger l&apos;interface sans backend, <span className="donnee">
            npm run db:demo
          </span>{" "}
          pose un catalogue de démonstration.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-14 py-6">
      {/* Le premier écran n'est pas un empilement titre / sous-titre / boutons.
          C'est la donnée elle-même, à l'échelle : le nombre de sessions tient
          lieu de titre, et la réglure de l'année occupe toute la largeur. Ce
          que le site montre, c'est un calendrier. */}
      <section>
        {/* Un seul bloc de texte, ancré à gauche, au-dessus d'un artefact qui
            traverse la page : le titre et sa phrase se tiennent, au lieu d'être
            plaqués aux deux bords avec un vide au milieu. */}
        <div className="max-w-2xl">
          <h1 className="signature text-[clamp(2.75rem,7vw,4.75rem)] leading-[0.95] text-encre">
            <Nombre valeur={sessions.length} /> sessions
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-encre-2">
            à venir chez{" "}
            <Link href="/organismes" className={lien}>
              {nbOrganismes} organismes
            </Link>
            , dans {nbVilles} villes. Relevées chaque nuit, réparties comme ceci
            sur les douze prochains mois.
          </p>
        </div>

        {/* La réglure sort de la mesure et traverse la fenêtre : le titre
            appartient à la colonne de texte, l'artefact appartient à la page.
            C'est le seul élément qui franchit cette limite, et c'est lui qui
            donne son relief au premier écran. */}
        <div className="pleine-largeur mt-9 px-5 sm:px-8">
          {/* Deux jeux de proportions pour la même donnée. Le repère de la
              réglure fait 1000 unités de large : à 390 px de fenêtre, les
              proportions du bureau donneraient une frise de soixante pixels de
              haut aux légendes illisibles. Un seul des deux est affiché, donc
              un seul est exposé aux lecteurs d'écran. */}
          <div className="sm:hidden">
            <Reglure
              sessions={sessions}
              hauteur={330}
              remplissage={0.5}
              libelles
              tailleLibelle={34}
            />
          </div>
          <div className="hidden sm:block">
            <Reglure
              sessions={sessions}
              hauteur={170}
              remplissage={0.46}
              libelles
              tailleLibelle={13}
            />
          </div>
        </div>
      </section>

      <section className="max-w-2xl">
        <form method="get" action="/formations" className="flex gap-2">
          <input type="hidden" name="f" value="1" />
          <input type="hidden" name="permanentes" value="1" />
          <label htmlFor="q-accueil" className="sr-only">
            Chercher une formation
          </label>
          <input
            id="q-accueil"
            name="q"
            type="search"
            placeholder="CACES, habilitation électrique, SST"
            className={`${champ} h-11 flex-1 text-[15px]`}
          />
          <button type="submit" className={`${action} h-11 px-5`}>
            Chercher
          </button>
        </form>
        <p className="mt-2.5 text-sm text-encre-3">
          ou{" "}
          <Link href="/formations" className={lien}>
            parcourir les <Nombre valeur={nbFormations} /> formations
          </Link>
          .
        </p>
      </section>

      {peuples.length > 0 && (
        <section>
          <h2 className="text-sm text-encre-3">Par domaine</h2>
          {/* Une liste de mots, pas une rangée d'étiquettes teintées : le nom
              et son compte suffisent à hiérarchiser. */}
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {peuples.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/formations?f=1&permanentes=1&domaine=${d.id}`}
                  className="group inline-flex items-baseline gap-1.5 text-[15px] text-encre transition-colors hover:text-vif"
                >
                  {d.nom}
                  <span className="donnee text-[13px] text-encre-4 transition-colors group-hover:text-vif">
                    {d._count.formations}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
