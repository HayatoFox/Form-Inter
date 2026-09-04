import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SearchFilters } from "@/components/SearchFilters";
import { FormationCard } from "@/components/FormationCard";
import { CHAMPS_CARTE } from "@/lib/champs-formation";
import { cleanupPastSessions } from "@/lib/session-cleanup";
import { planifierSyncAuto } from "@/lib/backend/auto";
import { centresAutour, positionVille } from "@/lib/geo/centres";
import { normaliserRayon } from "@/lib/geo/rayon";
import {
  construireFiltres,
  filtreExplicite,
  lireCriteres,
  parametresRecherche,
  type ParamsRecherche,
} from "@/lib/recherche";

// Le catalogue bouge à chaque synchronisation, et la page nettoie les sessions
// manuelles périmées à l'affichage : rien à préparer au build — où il n'y a de
// toute façon pas de base à interroger (construction de l'image Docker).
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const nombre = new Intl.NumberFormat("fr-FR");

type SearchParams = ParamsRecherche & {
  ville?: string;
  rayon?: string;
  page?: string;
};

export default async function FormationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await cleanupPastSessions();
  // Rafraîchit le catalogue depuis le backend quand le dernier passage est
  // périmé. Le travail est renvoyé après la réponse : la page ne l'attend pas.
  await planifierSyncAuto();

  const params = await searchParams;
  const criteres = lireCriteres(params);
  const ville = params.ville || undefined;
  // Rayon autour de la ville. Sans ville, il ne désigne rien : on l'ignore
  // plutôt que de deviner un centre.
  const rayonActif = ville ? normaliserRayon(params.rayon) : 0;
  const page = Math.max(1, Number(params.page) || 1);

  // « Rennes » sans rayon ne sort que Rennes, et laisse de côté les centres de
  // Cesson-Sévigné ou de Bruz qui sont à un quart d'heure. Avec un rayon, on
  // résout la position de la ville — depuis un centre déjà localisé neuf fois
  // sur dix, donc sans appel réseau — puis on liste les centres du disque. Le
  // filtre porte ensuite sur des identifiants : la base ne fait aucune
  // trigonométrie, et OpenStreetMap n'est pas sollicité.
  let restrictionLieu: Prisma.SessionWhereInput | undefined;
  if (ville && rayonActif > 0) {
    const point = await positionVille(ville);
    restrictionLieu = point
      ? {
          centreId: {
            in: (await centresAutour(point, rayonActif, { limite: 500 })).map(
              (c) => c.id
            ),
          },
        }
      : // Ville impossible à situer : on retombe sur l'égalité de nom plutôt
        // que de rendre un catalogue vide sans explication.
        { centre: { ville: { contains: ville } } };
  } else if (ville) {
    restrictionLieu = { centre: { ville: { contains: ville } } };
  }

  const { sessionFilter, formationFilter: where } = construireFiltres(
    criteres,
    restrictionLieu
  );

  const explicite = filtreExplicite(criteres, { ...params, ville });

  const [
    domaines,
    organismes,
    villesRaw,
    total,
    totalSessions,
    formations,
  ] = await Promise.all([
    prisma.domaine.findMany({ orderBy: { nom: "asc" } }),
    prisma.organisme.findMany({ orderBy: { nom: "asc" } }),
    prisma.centre.findMany({
      select: { ville: true },
      distinct: ["ville"],
      orderBy: { ville: "asc" },
    }),
    prisma.formation.count({ where }),
    // Une formation regroupe toutes ses dates et tous ses lieux : le catalogue
    // compte donc bien moins de formations que de sessions. Afficher les deux
    // évite de croire à des données manquantes en comparant avec le site de
    // veille, qui compte des sessions.
    prisma.session.count({ where: { ...sessionFilter, formation: where } }),
    // Tout ce qu'on ramène ici part dans la page pour l'hydratation du
    // composant client : ramener l'objet entier coûtait 451 Ko de HTML pour
    // vingt cartes. `CHAMPS_CARTE` est la liste exacte des champs affichés.
    prisma.formation.findMany({
      where,
      select: {
        ...CHAMPS_CARTE,
        sessions: {
          ...CHAMPS_CARTE.sessions,
          where: sessionFilter,
          orderBy: { dateDebut: { sort: "asc", nulls: "last" } },
        },
      },
      orderBy: { intitule: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const villes = villesRaw.map((v) => v.ville);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const sp = parametresRecherche(criteres, {
      ville,
      rayon: ville && rayonActif ? rayonActif : undefined,
      page: p,
    });
    return `/formations?${sp.toString()}`;
  }

  // Les mêmes critères, portés vers la carte — qui est l'accueil du site.
  // Passer d'une vue à l'autre ne doit pas obliger à ressaisir sa recherche.
  const versCarte = `/?${parametresRecherche(criteres, { adresse: ville }).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formations</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {nombre.format(total)} formation{total > 1 ? "s" : ""} trouvée
            {total > 1 ? "s" : ""}
            {" · "}
            {nombre.format(totalSessions)} session
            {totalSessions > 1 ? "s" : ""} au total
          </p>
        </div>
        {/* La même recherche, vue depuis la carte. Les critères suivent. */}
        <Link
          href={versCarte}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Voir sur la carte →
        </Link>
      </div>

      <SearchFilters
        domaines={domaines}
        organismes={organismes}
        villes={villes}
        current={{
          q: criteres.q,
          domaine: criteres.domaineId,
          ville,
          rayon: rayonActif,
          organisme: criteres.organismeId,
          dateFrom: criteres.dateFrom,
          dateTo: criteres.dateTo,
          passees: criteres.passees,
          permanentes: criteres.permanentes,
        }}
      />

      {formations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Aucune formation ne correspond à ces critères.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {formations.map((f) => (
            <FormationCard
              key={f.id}
              formation={f}
              sessionsFiltered={explicite}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              className={`rounded-md px-3 py-1.5 ${
                p === page
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
