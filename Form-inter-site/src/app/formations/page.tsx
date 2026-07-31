import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SearchFilters } from "@/components/SearchFilters";
import { FormationCard } from "@/components/FormationCard";
import { Pagination } from "@/components/ui/Pagination";
import { cleanupPastSessions } from "@/lib/session-cleanup";
import { planifierSyncAuto } from "@/lib/backend/auto";
import { debutDuJour, parseDateISO } from "@/lib/dates";

// Le catalogue bouge à chaque synchronisation, et la page nettoie les sessions
// manuelles périmées à l'affichage : rien à préparer au build — où il n'y a de
// toute façon pas de base à interroger (construction de l'image Docker).
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const nombre = new Intl.NumberFormat("fr-FR");

type SearchParams = {
  q?: string;
  domaine?: string;
  ville?: string;
  organisme?: string;
  dateFrom?: string;
  dateTo?: string;
  passees?: string;
  permanentes?: string;
  page?: string;
  /** Marqueur de formulaire soumis : sans lui, les cases prennent leur défaut. */
  f?: string;
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
  const q = params.q?.trim() || undefined;
  const domaineId = params.domaine || undefined;
  const ville = params.ville || undefined;
  const organismeId = params.organisme || undefined;
  const dateFrom = params.dateFrom || undefined;
  const dateTo = params.dateTo || undefined;
  const soumis = params.f === "1";
  const passees = soumis && params.passees === "1";
  const permanentes = soumis ? params.permanentes === "1" : true;
  const page = Math.max(1, Number(params.page) || 1);

  const aujourdhui = debutDuJour();

  // Contraintes portant sur les sessions datées. Les sessions à entrée/sortie
  // permanente (dateDebut nulle) n'y sont pas soumises : elles sont incluses ou
  // exclues en bloc.
  const contraintesDatees: Prisma.SessionWhereInput[] = [];
  if (!passees) {
    contraintesDatees.push({
      OR: [
        { dateFin: { gte: aujourdhui } },
        { dateFin: null, dateDebut: { gte: aujourdhui } },
      ],
    });
  }
  const borneDu = parseDateISO(dateFrom);
  const borneAu = parseDateISO(dateTo);
  if (borneDu) contraintesDatees.push({ dateDebut: { gte: borneDu } });
  if (borneAu) contraintesDatees.push({ dateDebut: { lte: borneAu } });

  const conditionsSession: Prisma.SessionWhereInput[] = [];
  if (ville) conditionsSession.push({ centre: { ville: { contains: ville } } });

  if (contraintesDatees.length > 0) {
    const datees: Prisma.SessionWhereInput = {
      AND: [{ dateDebut: { not: null } }, ...contraintesDatees],
    };
    conditionsSession.push(
      permanentes ? { OR: [{ dateDebut: null }, datees] } : datees
    );
  } else if (!permanentes) {
    conditionsSession.push({ dateDebut: { not: null } });
  }

  const sessionFilter: Prisma.SessionWhereInput | undefined =
    conditionsSession.length > 0 ? { AND: conditionsSession } : undefined;

  // Les cartes ne parlent de « sessions correspondantes » que si le visiteur a
  // lui-même restreint la recherche : la borne « à venir » posée par défaut
  // n'est pas un filtre de sa part.
  const filtreExplicite = Boolean(ville || dateFrom || dateTo || soumis);

  const where: Prisma.FormationWhereInput = {
    ...(domaineId && { domaineId }),
    ...(organismeId && { organismeId }),
    ...(q && {
      OR: [{ intitule: { contains: q } }, { description: { contains: q } }],
    }),
    ...(sessionFilter && { sessions: { some: sessionFilter } }),
  };

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
    prisma.formation.findMany({
      where,
      include: {
        organisme: true,
        domaine: true,
        sessions: {
          where: sessionFilter,
          include: { centre: true },
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
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (domaineId) sp.set("domaine", domaineId);
    if (ville) sp.set("ville", ville);
    if (organismeId) sp.set("organisme", organismeId);
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);
    sp.set("f", "1");
    if (passees) sp.set("passees", "1");
    if (permanentes) sp.set("permanentes", "1");
    sp.set("page", String(p));
    return `/formations?${sp.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Formations</h1>
        <p className="text-sm text-texte-doux">
          <span className="chiffres font-medium text-texte">
            {nombre.format(total)}
          </span>{" "}
          formation{total > 1 ? "s" : ""}
          <span className="text-texte-tenu"> · </span>
          <span className="chiffres font-medium text-texte">
            {nombre.format(totalSessions)}
          </span>{" "}
          session{totalSessions > 1 ? "s" : ""}
        </p>
      </div>

      <SearchFilters
        domaines={domaines}
        organismes={organismes}
        villes={villes}
        current={{
          q,
          domaine: domaineId,
          ville,
          organisme: organismeId,
          dateFrom,
          dateTo,
          passees,
          permanentes,
        }}
      />

      {formations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bordure-forte px-6 py-14 text-center">
          <p className="text-sm font-medium text-texte">
            Aucune formation ne correspond à ces critères.
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-texte-doux">
            Élargissez la période, retirez un filtre, ou{" "}
            <Link href="/formations" className="text-marque underline-offset-2 hover:underline">
              repartez de la liste complète
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {formations.map((f) => (
            <FormationCard
              key={f.id}
              formation={f}
              sessionsFiltered={filtreExplicite}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} href={pageHref} />
    </div>
  );
}
