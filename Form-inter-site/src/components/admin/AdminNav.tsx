"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const liens = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/organismes", label: "Organismes" },
  { href: "/admin/domaines", label: "Domaines" },
  { href: "/admin/formations", label: "Formations" },
  { href: "/admin/sources", label: "Sources de données" },
  { href: "/admin/import", label: "Import" },
];

/**
 * Onglets du back office. « Tableau de bord » est à la racine de /admin :
 * l'égalité stricte évite qu'il reste allumé sur toutes les autres pages.
 */
export function AdminNav() {
  const chemin = usePathname();

  return (
    <nav className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
      {liens.map((lien) => {
        const actif =
          lien.href === "/admin"
            ? chemin === "/admin"
            : chemin.startsWith(lien.href);
        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            /* Même règle que la barre publique : encre pleine et graisse
               pour la page courante, rien d'accroché autour. Une pastille
               teintée ici contredirait la barre du dessus. */
            className={
              actif
                ? "font-medium text-encre"
                : "text-encre-3 transition-colors hover:text-encre"
            }
          >
            {lien.label}
          </Link>
        );
      })}
    </nav>
  );
}
