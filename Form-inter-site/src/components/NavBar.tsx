"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const liens = [
  { href: "/formations", label: "Formations" },
  { href: "/organismes", label: "Organismes" },
];

/**
 * Barre de navigation. Le bleu de marque n'est pas étalé en bandeau plein : il
 * sert de signe — le carré du logo et le trait sous l'onglet actif. Sur un
 * outil qu'on garde ouvert la journée, une bande de couleur en haut de chaque
 * écran fatigue plus qu'elle n'aide.
 */
export function NavBar() {
  const chemin = usePathname();
  const actif = (href: string) => chemin === href || chemin.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-bordure bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/formations"
          className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-lg bg-action text-[13px] font-bold text-action-texte"
          >
            F
          </span>
          <span className="hidden sm:inline">
            Formations<span className="text-texte-doux"> Inter</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 text-sm">
          {liens.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              aria-current={actif(lien.href) ? "page" : undefined}
              className={`relative rounded-lg px-3 py-2 font-medium transition-colors ${
                actif(lien.href)
                  ? "text-texte after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-marque"
                  : "text-texte-doux hover:bg-surface-2 hover:text-texte"
              }`}
            >
              {lien.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/admin"
          className="rounded-lg px-3 py-2 text-sm font-medium text-texte-tenu transition-colors hover:bg-surface-2 hover:text-texte"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}
