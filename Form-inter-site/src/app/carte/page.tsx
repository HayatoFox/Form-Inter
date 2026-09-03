import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CarteRecherche } from "@/components/CarteRecherche";
import { cleanupPastSessions } from "@/lib/session-cleanup";
import { planifierSyncAuto } from "@/lib/backend/auto";
import { lireCriteres, parametresRecherche, type ParamsRecherche } from "@/lib/recherche";

/**
 * La seconde entrée du catalogue : par le lieu.
 *
 * `/formations` répond à « quelle formation, et où se donne-t-elle ? ».
 * Celle-ci répond à la question inverse, celle qu'on se pose avec un client au
 * téléphone : « qu'est-ce qui se donne autour de cette entreprise ? ». Mêmes
 * données, mêmes filtres — le module `@/lib/recherche` les définit une fois
 * pour les deux pages — mais l'entrée est une adresse et la réponse une carte.
 *
 * Le rendu est côté serveur pour les listes déroulantes seulement ; tout le
 * reste vit dans le navigateur et se met à jour en direct.
 */

export const dynamic = "force-dynamic";

type SearchParams = ParamsRecherche & { adresse?: string };

export default async function CartePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await cleanupPastSessions();
  await planifierSyncAuto();

  const params = await searchParams;
  const criteres = lireCriteres(params);

  const [domaines, organismes, centresSitues] = await Promise.all([
    prisma.domaine.findMany({ orderBy: { nom: "asc" } }),
    prisma.organisme.findMany({
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    prisma.centre.count({ where: { geoStatut: "ok" } }),
  ]);

  // Les mêmes critères, portés vers la liste.
  const versListe = `/formations?${parametresRecherche(criteres, {
    ville: params.adresse,
  }).toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Formations autour d&apos;une adresse
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Indiquez l&apos;adresse de l&apos;entreprise, réglez vos filtres :
            la carte suit en direct et montre où chaque formation se donne.
          </p>
        </div>
        <Link
          href={versListe}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ← Revenir à la liste
        </Link>
      </div>

      {/* Un centre sans coordonnées ne peut pas apparaître sur une carte : le
          dire ici évite de chercher une donnée absente sur un écran muet. */}
      {centresSitues === 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Aucun centre n&apos;est encore localisé : la carte restera vide. Rendez-vous
          dans Admin › Sources de données, bouton « Localiser les centres manquants ».
        </p>
      )}

      <CarteRecherche
        domaines={domaines}
        organismes={organismes}
        initial={{
          adresse: params.adresse,
          q: criteres.q,
          domaine: criteres.domaineId,
          organisme: criteres.organismeId,
          dateFrom: criteres.dateFrom,
          dateTo: criteres.dateTo,
          passees: criteres.passees,
          permanentes: criteres.permanentes,
        }}
      />
    </div>
  );
}
