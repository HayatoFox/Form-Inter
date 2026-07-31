import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanupPastSessions } from "@/lib/session-cleanup";
import { planifierSyncAuto } from "@/lib/backend/auto";
import { libelleMode, lireConfigBackend } from "@/lib/backend/config";
import { dernierPassageReussi, passageEnRetard } from "@/lib/backend/sync";
import { BACKEND, MANUEL } from "@/lib/backend/types";
import { DangerZone } from "@/components/admin/DangerZone";
import { Nombre } from "@/components/Nombre";
import { cadre } from "@/lib/ui";

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function AdminDashboardPage() {
  await cleanupPastSessions();
  await planifierSyncAuto();

  const [
    organismes,
    centres,
    formations,
    sessions,
    domaines,
    sessionsBackend,
    sessionsManuelles,
    config,
    dernierSync,
  ] = await Promise.all([
    prisma.organisme.count(),
    prisma.centre.count(),
    prisma.formation.count(),
    prisma.session.count(),
    prisma.domaine.count(),
    prisma.session.count({ where: { source: BACKEND } }),
    prisma.session.count({ where: { source: MANUEL } }),
    lireConfigBackend(),
    dernierPassageReussi(),
  ]);

  const stats = [
    { label: "Organismes", value: organismes, href: "/admin/organismes" },
    { label: "Centres", value: centres, href: "/admin/organismes" },
    { label: "Domaines", value: domaines, href: "/admin/domaines" },
    { label: "Formations", value: formations, href: "/admin/formations" },
    { label: "Sessions", value: sessions, href: "/admin/formations" },
  ];

  const liaisonActive = config.mode !== "off";
  const enRetard =
    liaisonActive && passageEnRetard(dernierSync, config.ttlMinutes);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="signature text-[26px] leading-tight text-encre">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`${cadre} p-4 transition-[box-shadow,background-color] duration-150 hover:bg-surface-creuse hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]`}
          >
            <Nombre valeur={s.value} className="donnee block text-2xl text-encre" />
            <div className="mt-0.5 text-sm text-encre-3">{s.label}</div>
          </Link>
        ))}
      </div>

      <Link
        href="/admin/sources"
        /* Pas de panneau teinté quand la liaison décroche : c'est la ligne
           d'alerte, en bas, qui porte la couleur. Un aplat orange derrière un
           bloc entier fait crier tout ce qu'il contient. */
        className={`${cadre} block p-6 transition-[box-shadow,background-color] duration-150 hover:bg-surface-creuse hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]`}
      >
        <h2 className="signature text-[17px] text-encre">Liaison backend</h2>
        <p className="mt-1 text-sm text-encre-2">
          {libelleMode(config.mode)}
          {liaisonActive && (
            <>
              {" · "}
              {dernierSync
                ? `dernière synchronisation ${horodatage.format(dernierSync.demarreLe)}`
                : "jamais synchronisée"}
            </>
          )}
        </p>
        <p className="mt-2 text-sm text-encre-2">
          <Nombre valeur={sessionsBackend} className="donnee text-encre" />{" "}
          du backend, <Nombre valeur={sessionsManuelles} className="donnee text-encre" />{" "}
          saisie(s) à la main
        </p>
        {enRetard && (
          <p className="mt-2 text-sm font-medium text-alerte">
            La dernière synchronisation réussie est ancienne : vérifiez la
            liaison.
          </p>
        )}
      </Link>

      {/* Une note de bas de page, pas un encadré pointillé : un filet en
          tirets autour d'un paragraphe est une structure décorative. */}
      <p className="max-w-3xl text-sm leading-relaxed text-encre-3">
        Le catalogue se remplit par deux chemins : la liaison avec le backend de
        veille et l&apos;import de fichiers Excel/CSV. Les sessions manuelles
        terminées sont supprimées à chaque visite de cette page ou de la
        recherche publique ; celles du backend suivent ce que publie
        l&apos;organisme.
      </p>

      <DangerZone counts={{ organismes, formations, sessions }} />
    </div>
  );
}
