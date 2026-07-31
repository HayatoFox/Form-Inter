import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanupPastSessions } from "@/lib/session-cleanup";
import { planifierSyncAuto } from "@/lib/backend/auto";
import { libelleMode, lireConfigBackend } from "@/lib/backend/config";
import { dernierPassageReussi, passageEnRetard } from "@/lib/backend/sync";
import { BACKEND, MANUEL } from "@/lib/backend/types";
import { DangerZone } from "@/components/admin/DangerZone";

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
      <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-[var(--rayon)] border border-trait bg-surface p-4 hover:shadow-md"
          >
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-sm text-encre-2">{s.label}</div>
          </Link>
        ))}
      </div>

      <Link
        href="/admin/sources"
        className={`block rounded-[var(--rayon)] border p-6 hover:shadow-md ${
          enRetard
            ? "border-alerte/30 bg-alerte/10"
            : "border-trait bg-surface"
        }`}
      >
        <h2 className="text-base font-semibold">Liaison backend</h2>
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
          {sessionsBackend} session(s) du backend · {sessionsManuelles}{" "}
          session(s) manuelle(s)
        </p>
        {enRetard && (
          <p className="mt-2 text-sm font-medium text-alerte">
            La dernière synchronisation réussie est ancienne : vérifiez la
            liaison.
          </p>
        )}
      </Link>

      <div className="rounded-[var(--rayon)] border border-dashed border-trait-fort p-6 text-sm text-encre-2">
        Le catalogue se remplit par deux chemins : la liaison avec le backend de
        veille et l&apos;import de fichiers Excel/CSV. Les sessions manuelles
        terminées sont supprimées à chaque visite de cette page ou de la
        recherche publique ; celles du backend suivent ce que publie
        l&apos;organisme.
      </div>

      <DangerZone counts={{ organismes, formations, sessions }} />
    </div>
  );
}
