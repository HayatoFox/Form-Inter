/**
 * Un nombre composé.
 *
 * `Intl.NumberFormat("fr-FR")` sépare les milliers par une espace fine
 * insécable (U+202F). C'est le caractère typographiquement juste, et presque
 * aucune fonte ne le dessine : ni Gambarino, ni la chasse fixe du système. Le
 * navigateur retombe alors sur une espace de chasse pleine et « 2 905 » s'écrit
 * avec un trou au milieu — très visible dès qu'on passe le corps du texte.
 *
 * On groupe donc les chiffres nous-mêmes et on dessine la séparation avec une
 * marge, en em, qu'on maîtrise à toutes les échelles.
 */
export function Nombre({
  valeur,
  className = "",
}: {
  valeur: number;
  className?: string;
}) {
  const groupes = String(Math.trunc(Math.abs(valeur)))
    .split("")
    .reverse()
    .join("")
    .match(/\d{1,3}/g)!
    .map((groupe) => groupe.split("").reverse().join(""))
    .reverse();

  return (
    <span className={`tabular-nums ${className}`}>
      {valeur < 0 && "-"}
      {groupes.map((groupe, i) => (
        <span key={i} className={i > 0 ? "ml-[0.16em]" : undefined}>
          {groupe}
        </span>
      ))}
    </span>
  );
}
