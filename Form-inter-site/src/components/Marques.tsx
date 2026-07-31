/**
 * Les marques du site.
 *
 * Il n'y a pas de jeu d'icônes ici, et surtout pas de pack de traits fins :
 * il y a deux signes, dessinés depuis la même géométrie que la réglure. La
 * règle de construction est celle du fût — des formes PLEINES (jamais un
 * contour tracé), des terminaisons coupées droit, et un chanfrein à 45° là où
 * un angle sortant tomberait. C'est ce chanfrein qu'on reconnaît d'un signe à
 * l'autre, et il n'appartient qu'à ce site.
 *
 * Ils sont posés nus sur la surface : ni tuile, ni pastille, ni rond derrière.
 */

/**
 * Le renvoi vers le site de l'organisme. Diagonale sortante plutôt que flèche
 * horizontale : on quitte le catalogue, on ne continue pas dedans. La tête est
 * une équerre dont l'angle extérieur est chanfreiné, exactement comme le pied
 * d'un fût.
 */
export function FlecheSortante({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      className={`inline-block shrink-0 align-[-0.08em] ${className}`}
    >
      {/* Le fût, couché à 45°. */}
      <path d="M2.35 11.95L11.95 2.35L13.65 4.05L4.05 13.65Z" />
      {/* L'équerre, chanfreinée à l'angle sortant. */}
      <path d="M7.3 2.35L12.5 2.35L13.65 3.5L13.65 8.7L11.75 8.7L11.75 4.25L7.3 4.25Z" />
    </svg>
  );
}

/**
 * La marque du site : trois fûts de la réglure, à trois charges d'encre, dont
 * un au bleu du mois courant. Ce n'est pas un contenant avec une initiale
 * dedans — c'est un fragment de l'artefact du site, donc la barre de nav
 * appartient au même système que les pages.
 */
export function Marque({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 18"
      width="20"
      height="18"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <line
        x1="0.5"
        y1="16.5"
        x2="19.5"
        y2="16.5"
        stroke="var(--trait-fort)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path d="M1 16.5L1 8.5L3 6.5L5 8.5L5 16.5Z" fill="var(--encre-3)" />
      <path d="M8 16.5L8 2.5L10 0.5L12 2.5L12 16.5Z" fill="var(--encre)" />
      <path d="M15 16.5L15 10.5L17 8.5L19 10.5L19 16.5Z" fill="var(--vif)" />
    </svg>
  );
}
