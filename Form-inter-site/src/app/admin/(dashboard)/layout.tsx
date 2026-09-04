import Link from "next/link";
import { getCurrentAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/LogoutButton";

const links = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/organismes", label: "Organismes" },
  // C'est le centre qui porte l'adresse, pas l'organisme : il a son écran.
  { href: "/admin/centres", label: "Centres" },
  { href: "/admin/domaines", label: "Domaines" },
  { href: "/admin/formations", label: "Formations" },
  { href: "/admin/sources", label: "Sources de données" },
  { href: "/admin/import", label: "Import" },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <nav className="flex flex-wrap gap-4 text-sm font-medium">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-zinc-500">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          {admin && <span>{admin.email}</span>}
          <LogoutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
