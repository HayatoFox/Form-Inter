import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FormulaireCentre } from "@/components/admin/FormulaireCentre";
import { deleteCentre, updateCentre } from "../organismes/actions";

/**
 * Les centres de formation, tous, sur un seul écran.
 *
 * Ils n'étaient éditables qu'à l'intérieur de la page de leur organisme : pour
 * compléter dix adresses il fallait passer par six pages et les retrouver dans
 * une liste. Or c'est le centre qui porte l'adresse, pas l'organisme — le siège
 * social d'un organisme n'est pas le lieu où se donne la formation.
 *
 * L'écran est trié pour le travail à faire : les centres SANS position d'abord,
 * puisque ce sont eux qui manquent à la carte.
 */

export const dynamic = "force-dynamic";

export default async function AdminCentresPage({
  searchParams,
}: {
  searchParams: Promise<{ organisme?: string; manquants?: string }>;
}) {
  const { organisme: organismeId, manquants } = await searchParams;
  const seulementManquants = manquants === "1";

  const [organismes, centres, total, situes] = await Promise.all([
    prisma.organisme.findMany({
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    prisma.centre.findMany({
      where: {
        ...(organismeId && { organismeId }),
        ...(seulementManquants && { latitude: null }),
      },
      include: { organisme: { select: { id: true, nom: true } } },
      orderBy: [{ organisme: { nom: "asc" } }, { ville: "asc" }],
    }),
    prisma.centre.count(),
    prisma.centre.count({ where: { NOT: { latitude: null } } }),
  ]);

  // Les centres absents de la carte remontent : c'est là qu'il y a à faire.
  const ordonnes = [...centres].sort((a, b) => {
    const manqueA = a.latitude === null ? 0 : 1;
    const manqueB = b.latitude === null ? 0 : 1;
    return (
      manqueA - manqueB ||
      a.organisme.nom.localeCompare(b.organisme.nom, "fr") ||
      a.ville.localeCompare(b.ville, "fr")
    );
  });

  const lienFiltre = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(params)) {
      if (valeur) sp.set(cle, valeur);
    }
    const chaine = sp.toString();
    return chaine ? `/admin/centres?${chaine}` : "/admin/centres";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Centres de formation
        </h1>
      {/* Les `{" "}` ne sont pas décoratifs : JSX supprime les espaces de tête
          et de fin d'un bloc de texte dès qu'il court sur plusieurs lignes.
          Sans eux on lisait « 33 apparaissentsur la carte » et
          « suggestions: sa position ». */}
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          {situes} centre{situes > 1 ? "s" : ""} sur {total}{" "}
          {situes > 1 ? "apparaissent" : "apparaît"}{" "}
          sur la carte. Les scrapers ne relèvent que la ville — c&apos;est tout
          ce que les organismes publient dans leur calendrier —, donc
          l&apos;adresse de rue se saisit ici.{" "}
          <strong>Choisissez-la dans la liste de suggestions</strong>{" "}
          : sa position est alors connue, et le centre est posé sur la carte dès
          l&apos;enregistrement, sans attendre de géocodage.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-zinc-500">
          Le nom d&apos;un centre rapatrié du backend n&apos;est pas modifiable
          ici : la synchronisation le retrouve par ce nom, et le renommer
          entraînerait la création d&apos;un doublon au passage suivant, avec
          ses sessions réparties entre les deux. Elle ne crée que les centres
          manquants et ne réécrit jamais une adresse saisie ici.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <span className="block text-xs font-medium text-zinc-500">
            Organisme
          </span>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <Link
              href={lienFiltre({ manquants: manquants })}
              className={`rounded-md px-3 py-1.5 ${
                organismeId
                  ? "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  : "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              }`}
            >
              Tous
            </Link>
            {organismes.map((o) => (
              <Link
                key={o.id}
                href={lienFiltre({ organisme: o.id, manquants })}
                className={`rounded-md px-3 py-1.5 ${
                  organismeId === o.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {o.nom}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href={lienFiltre({
            organisme: organismeId,
            manquants: seulementManquants ? undefined : "1",
          })}
          className={`rounded-md px-3 py-1.5 text-sm ${
            seulementManquants
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          Seulement les absents de la carte
        </Link>
      </div>

      {ordonnes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {seulementManquants
            ? "Tous les centres retenus apparaissent sur la carte."
            : "Aucun centre. Ils arrivent avec la synchronisation, ou s'ajoutent depuis la fiche d'un organisme."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordonnes.map((centre) => (
            <li key={centre.id}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-500">
                <Link
                  href={`/admin/organismes/${centre.organisme.id}`}
                  className="font-medium hover:underline"
                >
                  {centre.organisme.nom}
                </Link>
                <span>
                  {centre.adresse
                    ? "Adresse renseignée"
                    : "Ville seule — adresse à compléter"}
                </span>
              </div>
              <FormulaireCentre
                centre={centre}
                nomVerrouille={centre.source === "BACKEND"}
                action={updateCentre.bind(null, centre.organisme.id, centre.id)}
                onSupprimer={deleteCentre.bind(
                  null,
                  centre.organisme.id,
                  centre.id
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
