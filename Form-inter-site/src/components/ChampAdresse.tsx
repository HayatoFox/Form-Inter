"use client";

import { useEffect, useId, useState } from "react";

/**
 * Le champ d'adresse à autocomplétion, en un seul endroit.
 *
 * Deux écrans en ont besoin — la recherche de la carte et la fiche d'un centre
 * de formation au back office — et ce doit être la MÊME aide à la saisie, pas
 * deux versions qui divergeront au premier réglage. Tout ce qui relève de la
 * mécanique du champ vit donc ici : le retard de frappe, l'annulation des
 * requêtes en vol, la navigation au clavier, le repli quand le service
 * d'adresses ne répond pas.
 *
 * Ce que le composant ne décide PAS : ce qu'on fait de l'adresse choisie. La
 * carte en fait un point de départ, le back office en remplit trois colonnes.
 * D'où `onChoisir`, qui reçoit la suggestion entière — coordonnées et morceaux
 * compris — plutôt qu'un simple texte.
 */

export type Suggestion = {
  libelle: string;
  detail: string;
  genre: "centre" | "ville" | "cache" | "adresse";
  latitude?: number;
  longitude?: number;
  rue?: string;
  codePostal?: string;
  ville?: string;
};

export function ChampAdresse({
  valeur,
  onChange,
  onChoisir,
  placeholder,
  id,
  name,
  className,
  autoFocus,
}: {
  valeur: string;
  onChange: (texte: string) => void;
  onChoisir: (suggestion: Suggestion) => void;
  placeholder?: string;
  id?: string;
  /** Renseigné quand le champ participe à un formulaire classique. */
  name?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [listeOuverte, setListeOuverte] = useState(false);
  const [indexActif, setIndexActif] = useState(-1);
  const [saisieRetardee, setSaisieRetardee] = useState("");

  const idInterne = useId();
  const idChamp = id ?? idInterne;
  const idListe = `${idInterne}-liste`;

  // La frappe n'est envoyée qu'une fois posée : depuis que la Base Adresse
  // Nationale complète la liste, chaque lettre partirait vers un service
  // public. 250 ms, c'est le temps entre deux touches d'une frappe courante.
  useEffect(() => {
    const minuteur = setTimeout(() => setSaisieRetardee(valeur), 250);
    return () => clearTimeout(minuteur);
  }, [valeur]);

  useEffect(() => {
    // Liste refermée, rien à demander. Le garde-fou n'est pas cosmétique :
    // choisir une suggestion réécrit le champ, ce qui relançait le retardateur
    // et allait redemander des suggestions pour une liste déjà fermée — un
    // aller-retour serveur, et un appel au service d'adresses, pour rien.
    if (!listeOuverte) return;
    const texte = saisieRetardee.trim();
    if (texte.length < 2) return;
    const controleur = new AbortController();
    fetch(`/api/geo/suggestions?q=${encodeURIComponent(texte)}`, {
      signal: controleur.signal,
    })
      .then((reponse) => reponse.json())
      .then((donnees) => {
        setSuggestions(donnees.suggestions ?? []);
        setIndexActif(-1);
      })
      .catch(() => {
        // L'autocomplétion est un confort : son échec ne doit rien annoncer.
      });
    return () => controleur.abort();
  }, [saisieRetardee, listeOuverte]);

  // Sous deux caractères, la liste précédente ne veut plus rien dire. On la
  // masque au rendu plutôt que de vider l'état depuis un effet.
  const visibles =
    listeOuverte && saisieRetardee.trim().length >= 2 ? suggestions : [];

  function choisir(suggestion: Suggestion) {
    setListeOuverte(false);
    onChoisir(suggestion);
  }

  function touche(evenement: React.KeyboardEvent<HTMLInputElement>) {
    if (evenement.key === "Escape") {
      setListeOuverte(false);
      return;
    }
    if (evenement.key === "ArrowDown" || evenement.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      evenement.preventDefault();
      if (!listeOuverte) {
        setListeOuverte(true);
        setIndexActif(0);
        return;
      }
      const total = visibles.length;
      if (total === 0) return;
      const pas = evenement.key === "ArrowDown" ? 1 : -1;
      setIndexActif((precedent) => (precedent + pas + total) % total);
      return;
    }
    if (evenement.key === "Enter" && indexActif >= 0 && visibles[indexActif]) {
      // Entrée valide la suggestion surlignée, et NON le formulaire : sans ce
      // garde-fou, la flèche puis Entrée validait le texte tapé à moitié.
      evenement.preventDefault();
      choisir(visibles[indexActif]);
    }
  }

  return (
    <div className="relative">
      <input
        id={idChamp}
        name={name}
        type="text"
        value={valeur}
        onChange={(e) => {
          onChange(e.target.value);
          setListeOuverte(true);
        }}
        onKeyDown={touche}
        onBlur={() => setListeOuverte(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        // Le navigateur proposerait ses propres adresses par-dessus les nôtres,
        // et les deux listes se recouvriraient.
        autoComplete="off"
        role="combobox"
        aria-expanded={visibles.length > 0}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={
          indexActif >= 0 ? `${idListe}-${indexActif}` : undefined
        }
        className={
          className ??
          "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        }
      />

      {visibles.length > 0 && (
        <ul
          id={idListe}
          role="listbox"
          className="absolute z-1000 mt-1 max-h-72 w-full min-w-[18rem] overflow-y-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {visibles.map((suggestion, index) => (
            <li key={`${suggestion.genre}-${suggestion.libelle}`}>
              <button
                type="button"
                id={`${idListe}-${index}`}
                role="option"
                aria-selected={index === indexActif}
                // Le clic doit être pris AVANT que le champ perde le focus,
                // sinon `onBlur` referme la liste et l'élément disparaît sous
                // le curseur avant d'avoir reçu le clic.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(suggestion)}
                onMouseEnter={() => setIndexActif(index)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  index === indexActif ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <span className="block truncate font-medium">
                  {suggestion.libelle}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {suggestion.detail}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
