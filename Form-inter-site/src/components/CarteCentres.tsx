"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as CarteLeaflet, LayerGroup, Circle, Marker } from "leaflet";
import { formatDistance } from "@/lib/geo/distance";
import { RAYON_MAX, RAYON_PAS } from "@/lib/geo/rayon";
import { action, cadre, champ, legende } from "@/lib/ui";

/**
 * « Où se former près de mon client ? »
 *
 * On saisit une adresse, la carte s'ouvre dessus et montre les centres autour.
 * Le curseur élargit le rayon ; cliquer un repère donne la distance.
 *
 * Sobriété des appels — c'est la contrainte qui a dessiné ce composant :
 *
 * - l'adresse du client part UNE FOIS au géocodeur, et le serveur la met en
 *   cache : la ressaisir plus tard ne coûte plus rien ;
 * - bouger le curseur n'interroge QUE notre base, jamais OpenStreetMap : les
 *   centres sont déjà localisés ;
 * - les tuiles viennent d'un fond configurable. Par défaut celui d'OSM, dont
 *   la politique tolère un usage modeste ; le jour où le trafic grossit, on
 *   change une variable d'environnement sans toucher au code.
 *
 * Les distances sont à VOL D'OISEAU et le composant le dit. Une distance
 * routière demanderait un service d'itinéraires — le serveur public d'OSRM
 * interdit l'usage en production, et en héberger un pour cinq organismes
 * serait disproportionné.
 */

const TUILES =
  process.env.NEXT_PUBLIC_TUILES_URL ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_TUILES_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export type CentreCarte = {
  id: string;
  nom: string;
  ville: string;
  codePostal: string | null;
  adresse: string | null;
  latitude: number;
  longitude: number;
  organismeId: string;
  organismeNom: string;
  distanceKm: number;
};

type Depart = { latitude: number; longitude: number; libelle: string };

/**
 * Le repère : le fût chanfreiné de la réglure, posé sur sa pointe. Pas la
 * punaise bleue par défaut de Leaflet — celle-là appartient à tout le monde,
 * celui-ci appartient à ce site. Le fût du mois courant est en bleu, comme
 * dans la réglure ; le point de départ du client aussi.
 */
function marqueur(couleur: string, taille = 26): string {
  const l = taille * 0.62;
  const c = l * 0.22;
  return `
    <svg width="${l}" height="${taille}" viewBox="0 0 ${l} ${taille}" aria-hidden="true"
         style="display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))">
      <path d="M${l / 2} ${taille}L0 ${l * 0.9}L0 ${c}L${c} 0L${l - c} 0L${l} ${c}L${l} ${l * 0.9}Z"
            style="fill:${couleur}" />
    </svg>`;
}

export function CarteCentres({
  formationId,
  intitule,
}: {
  formationId: string;
  intitule: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeaflet | null>(null);
  const couche = useRef<LayerGroup | null>(null);
  const cercle = useRef<Circle | null>(null);
  const depuisMarqueur = useRef<Marker | null>(null);

  const [adresse, setAdresse] = useState("");
  const [depart, setDepart] = useState<Depart | null>(null);
  const [centres, setCentres] = useState<CentreCarte[]>([]);
  const [rayon, setRayon] = useState(50);
  // Le rayon affiché suit le curseur en continu ; le rayon DESSINÉ ne bouge
  // qu'au relâchement. Sans cette distinction, chaque pixel de glissement
  // redessinerait la carte et rechargerait des tuiles pour rien.
  const [rayonDessine, setRayonDessine] = useState(50);
  const [toutesFormations, setToutesFormations] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<CentreCarte | null>(null);

  const idAdresse = useId();
  const idRayon = useId();

  // --- Dessin ---------------------------------------------------------------

  const redessiner = useCallback(
    async (point: Depart, liste: CentreCarte[], km: number) => {
      const L = (await import("leaflet")).default;
      if (!conteneur.current) return;

      if (!carte.current) {
        carte.current = L.map(conteneur.current, {
          scrollWheelZoom: false, // le défilement de la page reste prioritaire
          attributionControl: true,
        });
        // La vue initiale n'est pas cosmétique : tant qu'une carte Leaflet n'a
        // ni centre ni zoom, elle n'attache pas ses couches. Le disque ajouté
        // ensuite n'a alors pas de `_map`, et `getBounds()` échoue sur
        // `layerPointToLatLng` — la carte reste grise et vide, sans rien dans
        // la console qui désigne la cause.
        carte.current.setView([point.latitude, point.longitude], 10);
        L.tileLayer(TUILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(
          carte.current
        );
        couche.current = L.layerGroup().addTo(carte.current);
      }

      const c = carte.current;
      couche.current?.clearLayers();
      cercle.current?.remove();
      depuisMarqueur.current?.remove();

      cercle.current = L.circle([point.latitude, point.longitude], {
        radius: km * 1000,
        // Les couleurs passent par une classe : Leaflet écrit `color` et
        // `fillColor` dans des attributs de présentation SVG, où `var()` ne se
        // résout pas. En CSS, si — et le disque suit alors le thème.
        className: "carte-disque",
        weight: 1,
      }).addTo(c);

      depuisMarqueur.current = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          html: marqueur("var(--vif)", 30),
          className: "",
          iconSize: [19, 30],
          iconAnchor: [9, 30],
        }),
        title: point.libelle,
        zIndexOffset: 500,
      })
        .bindPopup(`<strong>Point de départ</strong><br>${point.libelle}`)
        .addTo(c);

      for (const centre of liste) {
        L.marker([centre.latitude, centre.longitude], {
          icon: L.divIcon({
            html: marqueur("var(--encre)"),
            className: "",
            iconSize: [16, 26],
            iconAnchor: [8, 26],
          }),
          title: `${centre.organismeNom} — ${centre.ville}`,
        })
          .on("click", () => setChoisi(centre))
          .bindPopup(
            `<strong>${centre.organismeNom}</strong><br>${
              centre.adresse ? `${centre.adresse}<br>` : ""
            }${centre.codePostal ?? ""} ${centre.ville}<br>` +
              `<span style="opacity:.7">${formatDistance(
                centre.distanceKm
              )} à vol d'oiseau</span>`
          )
          .addTo(couche.current!);
      }

      // Le cadrage suit le disque demandé, pas les repères : c'est ce que le
      // curseur promet. Sans cela, élargir le rayon sans nouveau centre à
      // afficher ne bougerait pas la carte, et le curseur semblerait mort.
      c.fitBounds(cercle.current.getBounds(), { padding: [24, 24] });
    },
    []
  );

  // --- Chargements ----------------------------------------------------------

  async function chercherAdresse(e: React.FormEvent) {
    e.preventDefault();
    const saisie = adresse.trim();
    if (saisie.length < 3) return;

    setEnCours(true);
    setErreur(null);
    setChoisi(null);
    try {
      setRayonDessine(rayon);
      const params = new URLSearchParams({ adresse: saisie, rayon: String(rayon) });
      if (!toutesFormations) params.set("formation", formationId);
      const reponse = await fetch(`/api/geo/adresse?${params}`);
      const donnees = await reponse.json();

      if (!reponse.ok) {
        setErreur(donnees.erreur ?? "Recherche impossible.");
        return;
      }
      setDepart(donnees.depart);
      setCentres(donnees.centres);
    } catch {
      setErreur("Recherche impossible : vérifiez la connexion.");
    } finally {
      setEnCours(false);
    }
  }

  // Le rayon et le périmètre ne touchent que notre base : on peut les faire
  // varier autant qu'on veut.
  const rafraichir = useCallback(
    async (km: number, toutes: boolean) => {
      if (!depart) return;
      setEnCours(true);
      try {
        const params = new URLSearchParams({
          lat: String(depart.latitude),
          lon: String(depart.longitude),
          rayon: String(km),
        });
        if (!toutes) params.set("formation", formationId);
        const reponse = await fetch(`/api/geo/centres?${params}`);
        const donnees = await reponse.json();
        if (reponse.ok) {
          setCentres(donnees.centres);
          setRayonDessine(km);
        }
      } finally {
        setEnCours(false);
      }
    },
    [depart, formationId]
  );

  // Le dessin est déclenché par un effet, jamais depuis le gestionnaire de
  // soumission. La raison est concrète : le conteneur de la carte n'est monté
  // que lorsqu'un départ existe, et appeler Leaflet dans la foulée du
  // `setDepart` le fait travailler sur une boîte de taille nulle — il plante
  // sur `layerPointToLatLng`, et la carte reste vide. L'effet, lui, tourne
  // après le rendu qui a monté le conteneur.
  useEffect(() => {
    if (!depart) return;
    void redessiner(depart, centres, rayonDessine);
  }, [depart, centres, rayonDessine, redessiner]);

  useEffect(() => {
    return () => {
      carte.current?.remove();
      carte.current = null;
    };
  }, []);

  return (
    <section className={`${cadre} p-5`}>
      <h2 className="signature text-[17px] text-encre">Où se former</h2>
      <p className="mt-1 max-w-2xl text-sm text-encre-2">
        Indiquez l&apos;adresse du client : la carte montre les centres qui
        proposent cette formation autour de lui, et la distance de chacun.
      </p>

      <form onSubmit={chercherAdresse} className="mt-4 flex flex-wrap gap-2">
        <label htmlFor={idAdresse} className="sr-only">
          Adresse du client
        </label>
        <input
          id={idAdresse}
          type="text"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="12 rue de la Paix, 35000 Rennes"
          autoComplete="street-address"
          className={`${champ} min-w-0 flex-1`}
        />
        <button type="submit" disabled={enCours} className={action}>
          {enCours ? "Recherche…" : "Situer"}
        </button>
      </form>

      {erreur && (
        <p role="alert" className="mt-2 text-sm text-erreur">
          {erreur}
        </p>
      )}

      {depart && (
        <>
          <p className="mt-3 text-[13px] text-encre-3">
            Départ : <span className="text-encre-2">{depart.libelle}</span>
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-[14rem] flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={idRayon} className={legende}>
                  Rayon
                </label>
                <span className="donnee text-[13px] text-encre">{rayon} km</span>
              </div>
              <input
                id={idRayon}
                type="range"
                min={RAYON_PAS}
                max={RAYON_MAX}
                step={RAYON_PAS}
                value={rayon}
                onChange={(e) => setRayon(Number(e.target.value))}
                onPointerUp={() => rafraichir(rayon, toutesFormations)}
                onKeyUp={() => rafraichir(rayon, toutesFormations)}
                className="mt-2 h-4 w-full cursor-pointer accent-[var(--encre)]"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-encre-2">
              <input
                type="checkbox"
                checked={toutesFormations}
                onChange={(e) => {
                  setToutesFormations(e.target.checked);
                  rafraichir(rayon, e.target.checked);
                }}
                className="h-4 w-4 accent-[var(--encre)]"
              />
              Tous les organismes, pas seulement cette formation
            </label>
          </div>
        </>
      )}

      {/* Le conteneur n'est monté qu'une fois un départ connu — et non pas
          rendu puis masqué. Une carte de France vide au chargement n'apprend
          rien et coûterait des tuiles pour rien ; surtout, Leaflet ne sait pas
          s'initialiser dans une boîte que le CSS a mise à zéro. */}
      {depart && (
        <div
          ref={conteneur}
          className="carte-site mt-4 h-[26rem] overflow-hidden rounded-[var(--rayon)] shadow-[inset_0_0_0_1px_var(--trait)]"
        />
      )}

      {depart && (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[13px]">
          <p className="text-encre-3">
            <span className="donnee text-encre">{centres.length}</span> centre
            {centres.length > 1 ? "s" : ""} à moins de{" "}
            <span className="donnee">{rayon} km</span>
            {toutesFormations ? "" : ` proposant « ${intitule} »`}.
          </p>
          <p className="text-encre-4">
            Distances à vol d&apos;oiseau. Fond de carte OpenStreetMap.
          </p>
        </div>
      )}

      {choisi && (
        <p className="mt-2 text-sm text-encre-2">
          <span className="text-encre">{choisi.organismeNom}</span> à{" "}
          <span className="donnee text-encre">
            {formatDistance(choisi.distanceKm)}
          </span>{" "}
          — {choisi.adresse ? `${choisi.adresse}, ` : ""}
          {choisi.codePostal} {choisi.ville}
        </p>
      )}
    </section>
  );
}
