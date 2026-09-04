import { FlecheSortante } from "@/components/Marques";
import { formatDateCourt, formatPeriode } from "@/lib/dates";

/**
 * La liste des dates d'une formation, dans la modale comme sur la fiche.
 *
 * C'est un vrai tableau, et pas une pile de lignes en flex. La raison est
 * visible dès qu'on compare deux captures : en flex, chaque ligne dimensionne
 * ses colonnes toute seule, donc « 1 j », le tarif et la mention de places
 * atterrissent à une abscisse différente à chaque ligne, et une ville un peu
 * longue fait passer la ligne sur deux étages. Des lignes qui se comparent
 * doivent partager une grille. Un `<table>` la donne par construction, et
 * décrit en plus correctement ce que sont ces données.
 *
 * Les en-têtes sont là pour les lecteurs d'écran seulement : à l'affichage,
 * chaque colonne se lit d'elle-même, et six libellés au-dessus de douze lignes
 * seraient du bruit.
 */

const TENDUE = /derni|complet|limit|places? restante/i;

export type SessionListable = {
  id: string;
  dateDebut: Date | null;
  dateFin: Date | null;
  dureeJours: number | null;
  tarif: string | null;
  remarque: string | null;
  placesInfo: string | null;
  urlProgramme?: string | null;
  sourceUrl: string | null;
  centre: { nom: string; ville: string } | null;
};

/**
 * Beaucoup d'organismes nomment leur centre d'après sa ville. « Nancy, Nancy »
 * se lit comme un bug ; on ne répète donc que ce qui ajoute quelque chose.
 */
function lieu(centre: { nom: string; ville: string } | null): string {
  if (!centre) return "lieu à confirmer";
  const nom = centre.nom.trim();
  const ville = centre.ville.trim();
  if (!nom || nom === ville) return ville;
  if (nom.toLowerCase().includes(ville.toLowerCase())) return nom;
  return `${nom}, ${ville}`;
}

export function TableauSessions({
  sessions,
  format = "long",
  passees = false,
  compact = false,
}: {
  sessions: SessionListable[];
  /** La modale est étroite : les dates y sont abrégées. */
  format?: "court" | "long";
  /** Grise l'ensemble : ces sessions ont déjà eu lieu. */
  passees?: boolean;
  compact?: boolean;
}) {
  // Une gouttière serrée entre les colonnes, une marge pleine aux deux bords :
  // six colonnes à `px-5` mangeaient 240 px de gouttière et écrasaient la
  // mention de places sur trois lignes.
  const bord = compact ? "first:pl-5 last:pr-5" : "first:pl-4 last:pr-4";
  const cellule = `px-3 ${compact ? "py-2.5" : "py-3"} align-baseline ${bord}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Dates</th>
            <th scope="col">Lieu</th>
            <th scope="col">Durée</th>
            <th scope="col">Tarif</th>
            <th scope="col">Places</th>
            <th scope="col">Lien</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const url = s.urlProgramme ?? s.sourceUrl;
            const tendue = s.placesInfo ? TENDUE.test(s.placesInfo) : false;
            return (
              <tr
                key={s.id}
                className={`border-b border-trait transition-colors last:border-b-0 hover:bg-surface-creuse ${
                  passees ? "text-encre-3" : ""
                }`}
              >
                <td
                  className={`${cellule} donnee whitespace-nowrap ${
                    passees ? "" : "text-encre"
                  }`}
                >
                  {format === "court"
                    ? formatPeriode(s, formatDateCourt)
                    : formatPeriode(s)}
                </td>
                <td
                  className={`${cellule} w-full min-w-[7rem] ${
                    passees ? "" : "text-encre-2"
                  }`}
                >
                  {lieu(s.centre)}
                  {s.remarque && (
                    <span className="block text-[13px] text-encre-4 italic">
                      {s.remarque}
                    </span>
                  )}
                </td>
                <td
                  className={`${cellule} donnee text-right whitespace-nowrap text-encre-4`}
                >
                  {s.dureeJours !== null ? `${s.dureeJours} j` : ""}
                </td>
                <td
                  className={`${cellule} donnee text-right whitespace-nowrap ${
                    passees ? "" : "text-encre"
                  }`}
                >
                  {s.tarif ?? ""}
                </td>
                <td
                  className={`${cellule} text-[13px] whitespace-nowrap ${
                    !passees && tendue ? "text-alerte" : "text-encre-4"
                  }`}
                >
                  {s.placesInfo ?? ""}
                </td>
                <td className={`${cellule} text-right`}>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-encre-4 transition-colors hover:text-vif"
                    >
                      <span className="sr-only">
                        Voir cette session chez l&apos;organisme
                      </span>
                      <FlecheSortante />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
