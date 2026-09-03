"use client";

import { useState } from "react";
import { ChampAdresse, type Suggestion } from "@/components/ChampAdresse";

/**
 * La fiche d'un centre de formation, au back office.
 *
 * Le champ adresse est celui de la carte — le même composant, pas une copie —
 * mais ce qu'on fait de la suggestion diffère : la carte en tire un point de
 * départ, ici on remplit trois colonnes et on POSE LE CENTRE SUR LA CARTE.
 *
 * C'est le point important. Le service d'adresses rend les coordonnées avec
 * chaque proposition : choisir dans la liste les transmet au formulaire, et le
 * centre est situé dès l'enregistrement. Sans cela il aurait fallu attendre le
 * prochain passage de géocodage (une requête par seconde) pour le voir
 * apparaître.
 *
 * Corollaire : si l'adresse est ensuite retouchée à la main, les coordonnées
 * retenues ne correspondent plus à ce qui est écrit. Elles sont donc OUBLIÉES
 * dès la première frappe — mieux vaut un centre à géocoder qu'un centre posé au
 * mauvais endroit avec l'air d'être juste.
 */

export type CentreModifiable = {
  id: string;
  nom: string;
  ville: string;
  codePostal: string | null;
  adresse: string | null;
  latitude: number | null;
  geoStatut: string;
  geoLibelle: string | null;
};

const CHAMP =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const ETIQUETTE = "block text-xs font-medium text-zinc-500";

/** Où en est la localisation de ce centre, en clair. */
export function etatGeo(centre: { geoStatut: string; latitude: number | null }) {
  if (centre.latitude === null)
    return {
      texte:
        centre.geoStatut === "introuvable"
          ? "Absent de la carte : adresse non reconnue"
          : "Absent de la carte : à localiser",
      ton: "text-red-700 dark:text-red-400",
    };
  if (centre.geoStatut === "ok")
    return { texte: "Situé sur la carte", ton: "text-emerald-700 dark:text-emerald-400" };
  return {
    texte: "Sur la carte, position à affiner",
    ton: "text-amber-700 dark:text-amber-400",
  };
}

/** Le centre vide du formulaire d'ajout. */
export const CENTRE_NEUF: CentreModifiable = {
  id: "",
  nom: "",
  ville: "",
  codePostal: null,
  adresse: null,
  latitude: null,
  geoStatut: "attente",
  geoLibelle: null,
};

export function FormulaireCentre({
  centre,
  action,
  onSupprimer,
  nomVerrouille,
  creation,
}: {
  centre: CentreModifiable;
  action: (formData: FormData) => void | Promise<void>;
  onSupprimer?: (formData: FormData) => void;
  /** Formulaire d'ajout : les champs se vident après l'enregistrement. */
  creation?: boolean;
  /**
   * Vrai pour un centre rapatrié du backend. La synchronisation le retrouve
   * PAR SON NOM : le renommer ici ne le renommerait pas là-bas, et le prochain
   * passage recréerait un second centre pour la même ville, avec ses sessions
   * réparties entre les deux. L'adresse, elle, reste libre — c'est justement ce
   * que le backend ne connaît pas.
   */
  nomVerrouille?: boolean;
}) {
  const [nom, setNom] = useState(centre.nom);
  const [ville, setVille] = useState(centre.ville);
  const [codePostal, setCodePostal] = useState(centre.codePostal ?? "");
  const [adresse, setAdresse] = useState(centre.adresse ?? "");
  // La position retenue au moment du choix, transmise au serveur par champs
  // cachés. Nulle tant qu'aucune suggestion n'a été choisie dans cette session.
  const [position, setPosition] = useState<{
    latitude: number;
    longitude: number;
    libelle: string;
  } | null>(null);

  const geo = etatGeo(centre);

  function choisir(suggestion: Suggestion) {
    // Une commune sans rue ne doit pas écrire son nom dans le champ adresse :
    // « Cesson-Sévigné » n'est pas une adresse de rue, et la colonne ville est
    // là pour ça.
    setAdresse(suggestion.rue ?? "");
    if (suggestion.codePostal) setCodePostal(suggestion.codePostal);
    if (suggestion.ville) setVille(suggestion.ville);
    setPosition(
      suggestion.latitude !== undefined && suggestion.longitude !== undefined
        ? {
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
            libelle: suggestion.libelle,
          }
        : null
    );
  }

  // En création, les champs sont vidés après coup : sans cela le formulaire
  // resterait rempli du centre qu'on vient d'ajouter, et le geste naturel —
  // en ajouter un second — repartirait des valeurs du premier.
  async function envoyer(donnees: FormData) {
    await action(donnees);
    if (!creation) return;
    setNom("");
    setVille("");
    setCodePostal("");
    setAdresse("");
    setPosition(null);
  }

  return (
    <div className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <form action={envoyer} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={ETIQUETTE}>Nom du centre</label>
          {nomVerrouille ? (
            // Le nom s'affiche mais ne s'édite pas ; la raison est expliquée
            // une fois en tête d'écran, pas sur chacune des trente fiches.
            <>
              <p className="mt-1 py-2 text-sm font-medium">{centre.nom}</p>
              <input type="hidden" name="nom" value={centre.nom} />
            </>
          ) : (
            <input
              name="nom"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={CHAMP}
            />
          )}
        </div>

        <div className="sm:col-span-2">
          <label className={ETIQUETTE}>
            Adresse — choisissez dans la liste pour placer le centre sur la carte
          </label>
          <div className="mt-1">
            <ChampAdresse
              name="adresse"
              valeur={adresse}
              onChange={(texte) => {
                setAdresse(texte);
                // Saisie manuelle : la position choisie ne décrit plus ce qui
                // est écrit, on l'oublie.
                setPosition(null);
              }}
              onChoisir={choisir}
              placeholder="12 rue de la Paix, 35000 Rennes"
            />
          </div>
        </div>

        <div>
          <label className={ETIQUETTE}>Code postal</label>
          <input
            name="codePostal"
            value={codePostal}
            onChange={(e) => setCodePostal(e.target.value)}
            className={CHAMP}
          />
        </div>
        <div>
          <label className={ETIQUETTE}>Ville</label>
          <input
            name="ville"
            required
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className={CHAMP}
          />
        </div>

        {position && (
          <>
            <input type="hidden" name="latitude" value={position.latitude} />
            <input type="hidden" name="longitude" value={position.longitude} />
            <input type="hidden" name="geoLibelle" value={position.libelle} />
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {creation ? "Ajouter le centre" : "Enregistrer"}
          </button>

          {position ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Adresse localisée : sera posée sur la carte à l&apos;enregistrement
            </span>
          ) : creation ? (
            <span className="text-xs text-zinc-500">
              Sans adresse choisie dans la liste, le centre attendra le prochain
              géocodage.
            </span>
          ) : (
            <>
              <span className={`text-xs ${geo.ton}`}>{geo.texte}</span>
              {centre.geoLibelle && (
                <span className="text-xs text-zinc-500">
                  Reconnu comme : {centre.geoLibelle}
                </span>
              )}
            </>
          )}
        </div>
      </form>

      {onSupprimer && (
        <form action={onSupprimer} className="mt-2">
          <button type="submit" className="text-xs text-red-600 hover:underline">
            Supprimer ce centre
          </button>
        </form>
      )}
    </div>
  );
}
