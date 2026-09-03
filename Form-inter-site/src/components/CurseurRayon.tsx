"use client";

import { useId, useState } from "react";
import { RAYON_MAX, RAYON_PAS, libelleRayon } from "@/lib/geo/rayon";
import { legende } from "@/lib/ui";

/**
 * Le rayon autour de la ville choisie.
 *
 * Beaucoup de centres de formation sont en périphérie : chercher « Rennes »
 * sans rayon laisse de côté Cesson-Sévigné, Bruz ou Pacé, qui sont pourtant à
 * un quart d'heure. Le curseur répond exactement à ça.
 *
 * Le champ envoie des kilomètres, pas un indice de palier. Une graduation
 * irrégulière (10, 20, 30, 50, 75, 100…) collerait mieux aux distances qu'on
 * parcourt vraiment, mais elle obligerait à passer par un indice traduit en
 * JavaScript — et sans JavaScript le curseur ne servirait plus à rien. Dix
 * kilomètres par cran est moins fin et toujours utilisable.
 *
 * Le composant est client pour une seule raison : afficher la valeur en clair
 * pendant qu'on glisse.
 */

export function CurseurRayon({ valeur }: { valeur: number }) {
  const borne = Math.min(Math.max(valeur, 0), RAYON_MAX);
  const [km, setKm] = useState(borne);

  // `useState` ne s'amorce qu'au montage. Après un clic sur « 150 km autour »
  // pour retirer le filtre, React réutilise l'instance du composant : l'URL
  // n'a plus de rayon, mais le curseur restait à 150 et affichait le contraire
  // de ce que la page montrait. On réaligne pendant le rendu quand la valeur
  // venue du serveur a changé — le motif recommandé pour dériver un état
  // d'une prop sans effet ni clignotement.
  const [derniereProp, setDerniereProp] = useState(borne);
  if (derniereProp !== borne) {
    setDerniereProp(borne);
    setKm(borne);
  }

  const id = useId();
  const graduations = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={legende}>
          Rayon
        </label>
        <span className="donnee text-[13px] text-encre">
          {km <= 0 ? "ville seule" : `${km} km`}
        </span>
      </div>

      <input
        id={id}
        name="rayon"
        type="range"
        min={0}
        max={RAYON_MAX}
        step={RAYON_PAS}
        value={km}
        list={graduations}
        onChange={(e) => setKm(Number(e.target.value))}
        aria-label={`Rayon autour de la ville : ${libelleRayon(km)}`}
        className="mt-2 h-4 w-full cursor-pointer accent-[var(--encre)]"
      />
      <datalist id={graduations}>
        {[0, 30, 60, 90, 120, 150].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </div>
  );
}
