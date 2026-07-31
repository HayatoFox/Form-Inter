import { debutDuJour } from "@/lib/dates";

/**
 * La réglure — l'artefact de signature du site.
 *
 * Ce catalogue n'est pas une liste de fiches, c'est un calendrier : des
 * milliers de sessions datées réparties sur l'année. La réglure dessine
 * exactement cela, à partir des vraies dates : un fût par mois, sa hauteur
 * proportionnelle au nombre de sessions, le mois en cours marqué.
 *
 * Elle n'est pas décorative. Sur une carte, elle répond d'un coup d'œil à la
 * question qu'on se pose devant un catalogue de formations : est-ce que ça
 * tourne toute l'année, ou est-ce qu'il y a deux dates en mars ? Au premier
 * écran, la même géométrie passée à l'échelle tient lieu de composition : la
 * donnée est l'image.
 *
 * Rendue côté serveur, en SVG, sans état ni animation d'entrée : elle est
 * visible par défaut, y compris sans JavaScript. Une première version la
 * faisait pousser depuis le socle à l'arrivée ; la capture d'écran a montré
 * neuf colonnes sur douze absentes parce que le rendu passait pendant le
 * décalage. Du contenu qui dépend d'une animation pour exister est un contenu
 * qu'on perdra. La seule animation ici répond au survol, sur ce qui est déjà
 * affiché.
 *
 * Toute la géométrie est exprimée dans un repère de 1000 unités de large, et
 * le SVG occupe 100 % de son conteneur en hauteur automatique. Conséquence
 * utile : le chanfrein du pied grandit avec le reste, au lieu de disparaître
 * dès qu'on passe à l'échelle du premier écran.
 */

const REPERE = 1000;

const MOIS_COURTS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export type Creneau = { dateDebut: Date | null };

export type MoisReglure = {
  annee: number;
  mois: number; // 0-11
  nombre: number;
  courant: boolean;
};

/**
 * Répartit des sessions sur les `portee` mois à venir, mois courant compris.
 * Les sessions à entrée permanente n'ont pas de date : elles sont comptées à
 * part, puisqu'elles ne tombent dans aucune colonne.
 */
export function repartirParMois(
  sessions: Creneau[],
  portee = 12
): { mois: MoisReglure[]; permanentes: number; total: number } {
  const aujourdhui = debutDuJour();
  const anneeBase = aujourdhui.getUTCFullYear();
  const moisBase = aujourdhui.getUTCMonth();

  const mois: MoisReglure[] = Array.from({ length: portee }, (_, i) => {
    const glissant = new Date(Date.UTC(anneeBase, moisBase + i, 1));
    return {
      annee: glissant.getUTCFullYear(),
      mois: glissant.getUTCMonth(),
      nombre: 0,
      courant: i === 0,
    };
  });

  let permanentes = 0;
  let total = 0;

  for (const session of sessions) {
    if (!session.dateDebut) {
      permanentes += 1;
      total += 1;
      continue;
    }
    const ecart =
      (session.dateDebut.getUTCFullYear() - anneeBase) * 12 +
      (session.dateDebut.getUTCMonth() - moisBase);
    if (ecart < 0 || ecart >= portee) continue;
    mois[ecart].nombre += 1;
    total += 1;
  }

  return { mois, permanentes, total };
}

/**
 * Le fût : sommet plat, pied chanfreiné des deux côtés. C'est la forme
 * inventée pour ce site, et la seule ; on la retrouve à l'identique sur la
 * carte, dans la modale et au premier écran. Le chanfrein est proportionnel à
 * la largeur, pour rester lisible à toutes les échelles.
 */
function fut(x: number, largeur: number, base: number, hauteur: number): string {
  const chanfrein = Math.min(largeur * 0.22, hauteur * 0.5);
  const sommet = base - hauteur;
  return [
    `M${x} ${base}`,
    `L${x} ${sommet + chanfrein}`,
    `L${x + chanfrein} ${sommet}`,
    `L${x + largeur - chanfrein} ${sommet}`,
    `L${x + largeur} ${sommet + chanfrein}`,
    `L${x + largeur} ${base}`,
    "Z",
  ].join("");
}

/**
 * Quatre paliers d'encre plutôt qu'un dégradé continu : ça reste lisible.
 *
 * Le palier vient du RANG du mois parmi les mois pourvus, pas de son rapport
 * au maximum. Deux tentatives ont échoué avant celle-ci : le rapport au
 * maximum, puis le rapport à l'écart min-max. Toutes deux s'écroulent sur le
 * catalogue entier, où onze mois se tiennent entre 200 et 250 sessions et où
 * le mois courant, entamé, traîne le plancher vers zéro. Les douze fûts
 * sortaient au même noir : un peigne opaque qui ne dit plus rien.
 *
 * Par rang, la rampe existe toujours — le tiers le plus creux au plus pâle, le
 * tiers le plus chargé à l'encre. La hauteur porte la quantité, l'encre porte
 * le classement : deux lectures, pas une redite.
 */
function echelle(peuples: number[]): (nombre: number) => 0 | 1 | 2 | 3 {
  const valeurs = [...new Set(peuples)].sort((a, b) => a - b);
  return (nombre) => {
    if (nombre === 0) return 0;
    if (valeurs.length < 2) return 3;
    const rang = valeurs.indexOf(nombre) / (valeurs.length - 1);
    if (rang > 0.66) return 3;
    if (rang > 0.33) return 2;
    return 1;
  };
}

export function Reglure({
  sessions,
  hauteur = 120,
  remplissage = 0.56,
  portee = 12,
  libelles = false,
  tailleLibelle = 26,
  className = "",
}: {
  sessions: Creneau[];
  /** Hauteur des fûts, dans le repère de 1000 unités de large. */
  hauteur?: number;
  /** Part de sa colonne qu'occupe un fût. */
  remplissage?: number;
  portee?: number;
  libelles?: boolean;
  tailleLibelle?: number;
  className?: string;
}) {
  const { mois, permanentes, total } = repartirParMois(sessions, portee);
  const maximum = Math.max(...mois.map((m) => m.nombre), 1);
  const charge = echelle(mois.filter((m) => m.nombre > 0).map((m) => m.nombre));

  const pas = REPERE / portee;
  const largeurFut = pas * remplissage;
  const marge = (pas - largeurFut) / 2;

  const socle = hauteur;
  const hauteurLibelles = libelles ? tailleLibelle * 1.9 : 0;
  const hauteurTotale = socle + 2 + hauteurLibelles;

  // Un mois vide garde un talon visible : la colonne existe, elle est à zéro.
  // Sans lui, la réglure se troue et perd sa lecture de rythme.
  const talon = Math.max(3, hauteur * 0.035);

  return (
    <svg
      viewBox={`0 0 ${REPERE} ${hauteurTotale}`}
      preserveAspectRatio="none"
      className={`reglure block h-auto w-full ${className}`}
      style={{ aspectRatio: `${REPERE} / ${hauteurTotale}` }}
      role="img"
      aria-label={
        total === 0
          ? "Aucune session planifiée"
          : `Répartition de ${total} session${total > 1 ? "s" : ""} sur ${portee} mois` +
            (permanentes > 0 ? `, dont ${permanentes} à entrée permanente` : "")
      }
    >
      <line
        x1="0"
        y1={socle + 1}
        x2={REPERE}
        y2={socle + 1}
        className="reglure-socle"
        vectorEffect="non-scaling-stroke"
      />
      {mois.map((m, i) => {
        const utile = hauteur - talon;
        const h = m.nombre === 0 ? talon : talon + (m.nombre / maximum) * utile;
        const x = i * pas + marge;
        return (
          <g key={`${m.annee}-${m.mois}`} className="reglure-mois">
            <title>
              {MOIS_LONGS[m.mois]} {m.annee} : {m.nombre} session
              {m.nombre > 1 ? "s" : ""}
            </title>
            {/* Cible de survol pleine colonne : viser un fût de quelques pixels
                est impossible. */}
            <rect
              x={i * pas}
              y={0}
              width={pas}
              height={socle}
              fill="transparent"
            />
            <path
              d={fut(x, largeurFut, socle, h)}
              className="reglure-fut"
              data-charge={charge(m.nombre)}
              data-courant={m.courant ? "oui" : undefined}
            />
            {libelles && (
              <text
                x={i * pas + pas / 2}
                y={socle + tailleLibelle * 1.35}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={tailleLibelle}
                className="donnee reglure-libelle"
                fill={m.courant ? "var(--vif)" : "var(--encre-4)"}
              >
                {MOIS_COURTS[m.mois]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
