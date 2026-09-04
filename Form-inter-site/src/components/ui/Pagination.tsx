import Link from "next/link";

/**
 * Pagination à fenêtre glissante : la première page, la dernière, la courante
 * et ses voisines. Le squelette affichait un lien par page, lisible sur dix,
 * illisible dès que le catalogue grossit.
 */
function fenetre(courante: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, courante]);
  if (courante > 1) pages.add(courante - 1);
  if (courante < total) pages.add(courante + 1);
  // De quoi garder une largeur constante aux extrémités.
  if (courante <= 3) pages.add(2).add(3).add(4);
  if (courante >= total - 2) pages.add(total - 1).add(total - 2).add(total - 3);

  const triees = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const avecTrous: (number | "…")[] = [];
  let precedente = 0;
  for (const p of triees) {
    if (precedente && p - precedente > 1) avecTrous.push("…");
    avecTrous.push(p);
    precedente = p;
  }
  return avecTrous;
}

export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (p: number) => string;
}) {
  if (totalPages <= 1) return null;

  const base =
    "donnee inline-flex h-8 min-w-8 items-center justify-center rounded-[3px] px-2 text-[13px] transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1 pt-2"
    >
      {page > 1 && (
        <Link
          href={href(page - 1)}
          rel="prev"
          className={`${base} px-3 text-encre-3 hover:text-encre`}
        >
          Précédent
        </Link>
      )}

      {fenetre(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span
            key={`trou-${i}`}
            className="px-1 text-encre-4"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={
              p === page
                ? `${base} bg-action text-action-texte`
                : `${base} text-encre-3 hover:bg-surface-creuse hover:text-encre`
            }
          >
            {p}
          </Link>
        )
      )}

      {page < totalPages && (
        <Link
          href={href(page + 1)}
          rel="next"
          className={`${base} px-3 text-encre-3 hover:text-encre`}
        >
          Suivant
        </Link>
      )}
    </nav>
  );
}
