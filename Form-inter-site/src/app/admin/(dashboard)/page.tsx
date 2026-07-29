import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanupPastSessions } from "@/lib/session-cleanup";
import { DangerZone } from "@/components/admin/DangerZone";

export default async function AdminDashboardPage() {
  await cleanupPastSessions();

  const [organismes, centres, formations, sessions, domaines] =
    await Promise.all([
      prisma.organisme.count(),
      prisma.centre.count(),
      prisma.formation.count(),
      prisma.session.count(),
      prisma.domaine.count(),
    ]);

  const stats = [
    { label: "Organismes", value: organismes, href: "/admin/organismes" },
    { label: "Centres", value: centres, href: "/admin/organismes" },
    { label: "Domaines", value: domaines, href: "/admin/domaines" },
    { label: "Formations", value: formations, href: "/admin/formations" },
    { label: "Sessions", value: sessions, href: "/admin/formations" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-sm text-zinc-500">{s.label}</div>
          </Link>
        ))}
      </div>
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        Utilisez le menu ci-dessus pour gérer les organismes, domaines et
        formations, ou importer des données en masse depuis un fichier
        Excel/CSV. Les sessions dont la date de début est passée sont
        automatiquement supprimées à chaque visite de cette page ou de la
        recherche publique.
      </div>

      <DangerZone counts={{ organismes, formations, sessions }} />
    </div>
  );
}
