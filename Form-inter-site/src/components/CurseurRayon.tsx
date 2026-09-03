"use client";

import { useId, useState } from "react";
import { RAYON_MAX, RAYON_PAS, libelleRayon } from "@/lib/geo/rayon";

/**
 * Le rayon autour de la ville choisie.
 *
 * Beaucoup de centres de formation sont en périphérie : chercher « Rennes »
 * sans rayon laisse de côté Cesson-Sévigné, Bruz ou Pacé, qui sont pourtant à
 * un quart d'heure. Le curseur répond exactement à ça.
 *
 * Le champ envoie des kilomètres, pas un indice de palier. Une graduation
 * irrégulière (10, 20, 30, 50, 75…) collerait mieux aux distances qu'on
 * parcourt vraiment, mais elle obligerait à traduire l'indice en JavaScript —
 * et sans JavaScript le curseur ne servirait plus à rien. Dix kilomètres par
 * cran est moins fin et toujours utilisable.
 *
 * Le composant est client pour une seule raison : afficher la valeur en clair
 * pendant qu'on glisse.
 */
export function CurseurRayon({ valeur }: { valeur: number }) {
  const borne = Math.min(Math.max(valeur, 0), RAYON_MAX);
  const [km, setKm] = useState(borne);

  // `useState` ne s'amorce qu'au montage. Après un clic sur « Réinitialiser »,
  // React réutilise l'instance du composant : l'URL n'a plus de rayon, mais le
  // curseur resterait sur son ancienne valeur et afficherait le contraire de
  // ce que la page montre. On réaligne pendant le rendu quand la valeur venue
  // du serveur a changé.
  const [derniereProp, setDerniereProp] = useState(borne);
  if (derniereProp !== borne) {
    setDerniereProp(borne);
    setKm(borne);
  }

  const id = useId();

  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-xs font-medium text-zinc-500"
      >
        Rayon
        <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
          {km <= 0 ? "ville seule" : `${km} km`}
        </span>
      </label>
      <input
        id={id}
        name="rayon"
        type="range"
        min={0}
        max={RAYON_MAX}
        step={RAYON_PAS}
        value={km}
        onChange={(e) => setKm(Number(e.target.value))}
        aria-label={`Rayon autour de la ville : ${libelleRayon(km)}`}
        className="mt-3 w-full cursor-pointer accent-zinc-900 dark:accent-zinc-100"
      />
    </div>
  );
}
