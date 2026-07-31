"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marque } from "@/components/Marques";

const liens = [
  { href: "/formations", label: "Calendrier" },
  { href: "/organismes", label: "Organismes" },
];

export function NavBar() {
  const chemin = usePathname();
  const actif = (href: string) => chemin === href || chemin.startsWith(href + "/");

  return (
    <header className="mx-auto w-full max-w-[78rem] px-5 pt-5 sm:px-8">
      {/* Barre contenue, pas une rangée de liens collée au bord de la fenêtre :
          elle est posée sur le papier comme un objet, avec la même arête que
          les autres surfaces du site. */}
      {/* En dessous de 640 px la barre passe sur deux lignes plutôt que de
          pousser « Administration » hors de la fenêtre. */}
      <div className="cadre flex flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-[3px] text-[17px] whitespace-nowrap text-encre"
        >
          <Marque />
          <span className="signature">Formations Inter</span>
        </Link>

        <nav className="flex flex-1 items-center gap-5 text-sm">
          {liens.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              aria-current={actif(lien.href) ? "page" : undefined}
              /* L'état actif se lit dans le texte : encre pleine et graisse.
                 Pas de point ni de barre accrochés dessous. */
              className={
                actif(lien.href)
                  ? "font-medium text-encre"
                  : "text-encre-3 transition-colors hover:text-encre"
              }
            >
              {lien.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/admin"
          className="text-sm text-encre-4 transition-colors hover:text-encre"
        >
          Administration
        </Link>
      </div>
    </header>
  );
}
