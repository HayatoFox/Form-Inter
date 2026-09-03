"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { Map as CarteLeaflet, LayerGroup, Circle, Marker } from "leaflet";
import { formatDistance } from "@/lib/geo/distance";
import { RAYON_MAX, RAYON_PAS } from "@/lib/geo/rayon";
import { formatDateCourt } from "@/lib/dates";
import { ChampAdresse, type Suggestion } from "@/components/ChampAdresse";
import { corrigerAdresseCentre } from "@/app/actions/adresse-centre";
import {
  ATTRIBUTION,
  COULEUR_CENTRE,
  COULEUR_CHOISI,
  COULEUR_DEPART,
  TUILES,
  marqueur,
  marqueurCompte,
} from "@/lib/carte";

/**
 * Le catalogue vu depuis la carte.
 *
 * L'autre page part de la liste et finit sur un lieu ; celle-ci part du lieu.
 * On pose l'adresse de l'entreprise, on règle ses filtres, et les repères
 * suivent EN DIRECT — chaque frappe, chaque case cochée redessine la carte.
 *
 * Ce direct est possible parce qu'il ne coûte rien dehors : l'adresse part une
 * seule fois au géocodeur (et son résultat est mis en cache côté serveur), tout
 * le reste n'interroge que notre base, où les centres sont déjà localisés.
 * Trois précautions pour que « en direct » ne veuille pas dire « en rafale » :
 *
 * - le mot-clé est retardé de 300 ms, sinon chaque lettre partirait ;
 * - toute requête encore en vol est annulée quand la suivante part, ce qui
 *   évite qu'une réponse lente écrase une réponse récente ;
 * - le curseur de rayon ne déclenche qu'au relâchement.
 */

type Depart = { latitude: number; longitude: number; libelle: string };

type FormationCarte = {
  id: string;
  intitule: string;
  organismeNom: string;
  domaineNom: string | null;
  sessions: number;
  prochaine: string | null;
};

type CentreResultat = {
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
  formations: FormationCarte[];
  totalFormations: number;
  totalSessions: number;
};

type PlusProche = { organismeNom: string; ville: string; distanceKm: number };

export type CriteresInitiaux = {
  adresse?: string;
  q?: string;
  domaine?: string;
  organisme?: string;
  dateFrom?: string;
  dateTo?: string;
  passees?: boolean;
  permanentes?: boolean;
};

const nombre = new Intl.NumberFormat("fr-FR");

/** En dessous, ce n'est pas une adresse : inutile d'occuper le géocodeur. */
function adresseUtilisable(texte: string | undefined): boolean {
  return (texte?.trim().length ?? 0) >= 3;
}

/**
 * Résolution d'adresse, sans toucher à l'état : c'est la seule fonction du
 * fichier qui puisse coûter un appel à OpenStreetMap, et elle est appelée
 * aussi bien depuis un gestionnaire d'événement que depuis un effet de
 * montage. Les deux mettent l'état à jour eux-mêmes, après l'attente.
 */
async function resoudreAdresse(
  texte: string
): Promise<{ depart?: Depart; erreur?: string }> {
  try {
    // `centres=0` : on ne veut que le point. Les résultats viennent ensuite de
    // la route de la carte, qui les regroupe par centre.
    const reponse = await fetch(
      `/api/geo/adresse?adresse=${encodeURIComponent(texte.trim())}&centres=0`
    );
    const donnees = await reponse.json();
    if (!reponse.ok) return { erreur: donnees.erreur ?? "Recherche impossible." };
    return { depart: donnees.depart };
  } catch {
    return { erreur: "Recherche impossible : vérifiez la connexion." };
  }
}

export function CarteRecherche({
  domaines,
  organismes,
  initial,
}: {
  domaines: { id: string; nom: string }[];
  organismes: { id: string; nom: string }[];
  initial: CriteresInitiaux;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<CarteLeaflet | null>(null);
  const couche = useRef<LayerGroup | null>(null);
  const cercle = useRef<Circle | null>(null);
  const marqueurDepart = useRef<Marker | null>(null);
  // Clé du dernier cadrage automatique. La carte ne se recadre que si le point
  // de départ ou le rayon a changé : recadrer à chaque filtre annulerait le
  // déplacement que le visiteur vient de faire à la main.
  const dernierCadrage = useRef<string>("");
  // Repères indexés par centre, pour rouvrir une infobulle après un redessin.
  const marqueurs = useRef(new Map<string, Marker>());
  // Ce qu'il reste à faire une fois les repères reconstruits : rouvrir une
  // bulle, et éventuellement amener la carte dessus.
  const apresDessin = useRef<{ centreId: string; recentrer: boolean } | null>(
    null
  );

  const [adresse, setAdresse] = useState(initial.adresse ?? "");
  const [depart, setDepart] = useState<Depart | null>(null);
  // Une adresse arrivée par l'URL est résolue dès le montage : l'état part
  // donc déjà à « en cours », plutôt que d'être basculé depuis l'effet.
  const [situation, setSituation] = useState(adresseUtilisable(initial.adresse));
  const [erreur, setErreur] = useState<string | null>(null);

  const [q, setQ] = useState(initial.q ?? "");
  const [qRetarde, setQRetarde] = useState(initial.q ?? "");
  const [domaineId, setDomaineId] = useState(initial.domaine ?? "");
  const [organismeId, setOrganismeId] = useState(initial.organisme ?? "");
  const [dateFrom, setDateFrom] = useState(initial.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initial.dateTo ?? "");
  const [passees, setPassees] = useState(initial.passees ?? false);
  const [permanentes, setPermanentes] = useState(initial.permanentes ?? true);

  const [rayon, setRayon] = useState(50);
  const [rayonDessine, setRayonDessine] = useState(50);

  const [resultats, setResultats] = useState<CentreResultat[]>([]);
  const [totaux, setTotaux] = useState({ formations: 0, sessions: 0 });
  const [plusProche, setPlusProche] = useState<PlusProche | null>(null);
  // Combien de centres se trouvent dans le disque, avant application des
  // filtres : c'est ce qui distingue « personne ici » de « personne qui donne
  // ça ici ».
  const [centresDansRayon, setCentresDansRayon] = useState(0);
  const [choisi, setChoisi] = useState<string | null>(null);
  // Incrémenté quand une adresse de centre vient d'être corrigée : la clé
  // change, donc la recherche repart et le repère se déplace. Sans cela le
  // centre resterait affiché à son ancienne position jusqu'au prochain filtre.
  const [rechargements, setRechargements] = useState(0);

  // « En cours de mise à jour » n'est pas un état à poser : c'est un écart.
  // La clé décrit la recherche demandée, `cleAffichee` celle qui est à l'écran,
  // et tant que les deux diffèrent, une requête est en vol.
  const cleRequete = depart
    ? [
        depart.latitude,
        depart.longitude,
        rayonDessine,
        qRetarde.trim(),
        domaineId,
        organismeId,
        dateFrom,
        dateTo,
        passees,
        permanentes,
        rechargements,
      ].join("|")
    : "";
  const [cleAffichee, setCleAffichee] = useState("");
  const chargement = Boolean(depart) && cleRequete !== cleAffichee;

  const idAdresse = useId();
  const idRayon = useId();

  // --- Adresse ---------------------------------------------------------------

  async function lancer(texte: string) {
    if (!adresseUtilisable(texte)) return;
    setSituation(true);
    setErreur(null);
    const resultat = await resoudreAdresse(texte);
    setSituation(false);
    if (resultat.depart) {
      setChoisi(null);
      setDepart(resultat.depart);
    } else {
      setErreur(resultat.erreur ?? "Recherche impossible.");
    }
  }

  async function soumettreAdresse(evenement: React.FormEvent) {
    evenement.preventDefault();
    await lancer(adresse);
  }

  function choisirSuggestion(suggestion: Suggestion) {
    setAdresse(suggestion.libelle);

    // La suggestion porte déjà ses coordonnées : il n'y a rien à géocoder. On
    // pose le point de départ directement — pas d'aller-retour, pas une
    // requête de plus vers un service d'adresses.
    if (suggestion.latitude !== undefined && suggestion.longitude !== undefined) {
      setErreur(null);
      setChoisi(null);
      setDepart({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        libelle: suggestion.libelle,
      });
      return;
    }
    void lancer(suggestion.libelle);
  }

  // Une adresse portée par l'URL — le lien « Voir sur la carte » depuis la
  // liste — situe la carte sans attendre un clic de plus.
  const adresseInitiale = initial.adresse;
  useEffect(() => {
    if (!adresseUtilisable(adresseInitiale)) return;
    let annule = false;
    void resoudreAdresse(adresseInitiale!).then((resultat) => {
      if (annule) return;
      setSituation(false);
      if (resultat.depart) setDepart(resultat.depart);
      else setErreur(resultat.erreur ?? "Recherche impossible.");
    });
    return () => {
      annule = true;
    };
  }, [adresseInitiale]);

  // --- Le direct -------------------------------------------------------------

  // Le mot-clé ne part qu'une fois la frappe posée. Le rayon suit la même
  // règle : au clavier, chaque flèche déplace le curseur d'un cran, et sans ce
  // retard huit pressions faisaient huit recherches complètes.
  useEffect(() => {
    const minuteur = setTimeout(() => setQRetarde(q), 300);
    return () => clearTimeout(minuteur);
  }, [q]);

  useEffect(() => {
    const minuteur = setTimeout(() => setRayonDessine(rayon), 300);
    return () => clearTimeout(minuteur);
  }, [rayon]);

  useEffect(() => {
    if (!depart) return;

    const controleur = new AbortController();
    const params = new URLSearchParams({
      lat: String(depart.latitude),
      lon: String(depart.longitude),
      rayon: String(rayonDessine),
      // Marqueur de formulaire soumis : sans lui le serveur reprend ses
      // défauts, et décocher une case n'aurait aucun effet.
      f: "1",
    });
    if (qRetarde.trim()) params.set("q", qRetarde.trim());
    if (domaineId) params.set("domaine", domaineId);
    if (organismeId) params.set("organisme", organismeId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (passees) params.set("passees", "1");
    if (permanentes) params.set("permanentes", "1");

    fetch(`/api/carte/recherche?${params}`, { signal: controleur.signal })
      .then(async (reponse) => {
        const donnees = await reponse.json();
        if (!reponse.ok) throw new Error(donnees.erreur ?? "Recherche impossible.");
        setResultats(donnees.centres);
        setTotaux({
          formations: donnees.totalFormations,
          sessions: donnees.totalSessions,
        });
        setPlusProche(donnees.plusProche ?? null);
        setCentresDansRayon(donnees.centresDansRayon ?? 0);
        setErreur(null);
        setCleAffichee(cleRequete);
      })
      .catch(() => {
        // Une requête annulée par la suivante n'est pas une erreur.
        if (controleur.signal.aborted) return;
        setErreur("Recherche impossible : vérifiez la connexion.");
        // Sinon l'indicateur « mise à jour… » resterait allumé pour toujours.
        setCleAffichee(cleRequete);
      });

    return () => controleur.abort();
  }, [
    cleRequete,
    depart,
    qRetarde,
    domaineId,
    organismeId,
    dateFrom,
    dateTo,
    passees,
    permanentes,
    rayonDessine,
    rechargements,
  ]);

  // --- Dessin ---------------------------------------------------------------

  const choisirDepuisCarte = useCallback((centreId: string) => {
    // Sélectionner redessine les repères — c'est ainsi que le centre choisi
    // change de couleur — et la reconstruction emporte l'infobulle que Leaflet
    // venait d'ouvrir au clic. On note ce qu'il faudra rouvrir APRÈS le dessin,
    // sans quoi la bulle apparaît et disparaît dans le même souffle.
    apresDessin.current = { centreId, recentrer: false };
    setChoisi(centreId);
    // La carte a le focus, la liste est à côté : on amène la fiche du centre
    // sous les yeux plutôt que de laisser chercher.
    requestAnimationFrame(() => {
      document
        .getElementById(`centre-${centreId}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, []);

  /** Depuis la liste : on sélectionne, et la carte va se poser sur le point. */
  function choisirDepuisListe(centreId: string | null) {
    if (centreId) apresDessin.current = { centreId, recentrer: true };
    setChoisi(centreId);
  }

  useEffect(() => {
    if (!depart) return;
    let annule = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (annule || !conteneur.current) return;

      if (!carte.current) {
        carte.current = L.map(conteneur.current, {
          // La carte est le contenu principal de cette page, pas un encart au
          // milieu d'un texte : la molette y zoome. Elle ne capture le
          // défilement que sous le curseur, la page reste parcourable partout
          // ailleurs.
          scrollWheelZoom: true,
        });
        // Sans vue initiale, Leaflet n'attache pas ses couches : le disque
        // ajouté ensuite n'a pas de `_map` et `getBounds()` échoue.
        carte.current.setView([depart.latitude, depart.longitude], 10);
        L.tileLayer(TUILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(
          carte.current
        );
        couche.current = L.layerGroup().addTo(carte.current);
      }

      const c = carte.current;
      couche.current?.clearLayers();
      cercle.current?.remove();
      marqueurDepart.current?.remove();

      cercle.current = L.circle([depart.latitude, depart.longitude], {
        radius: rayonDessine * 1000,
        color: COULEUR_DEPART,
        weight: 1,
        fillColor: COULEUR_DEPART,
        fillOpacity: 0.06,
      }).addTo(c);

      marqueurDepart.current = L.marker([depart.latitude, depart.longitude], {
        icon: L.divIcon({
          html: marqueur(COULEUR_DEPART, 30),
          className: "",
          iconSize: [19, 30],
          iconAnchor: [9, 30],
        }),
        title: depart.libelle,
        zIndexOffset: 1000,
      })
        .bindPopup(`<strong>Point de départ</strong><br>${depart.libelle}`)
        .addTo(c);

      marqueurs.current.clear();
      for (const centre of resultats) {
        const actif = centre.id === choisi;
        const repere = L.marker([centre.latitude, centre.longitude], {
          icon: L.divIcon({
            html: marqueurCompte(
              actif ? COULEUR_CHOISI : COULEUR_CENTRE,
              centre.totalFormations,
              actif ? 34 : 28
            ),
            className: "",
            iconSize: [actif ? 21 : 17, actif ? 34 : 28],
            iconAnchor: [actif ? 10 : 8, actif ? 34 : 28],
          }),
          title: `${centre.organismeNom} — ${centre.ville}`,
          zIndexOffset: actif ? 800 : 0,
        })
          .on("click", () => choisirDepuisCarte(centre.id))
          .bindPopup(
            `<strong>${centre.organismeNom}</strong><br>` +
              // L'adresse de rue quand on l'a : c'est elle qu'on recopie dans
              // une convocation, pas le nom de la commune.
              (centre.adresse ? `${centre.adresse}<br>` : "") +
              `${centre.codePostal ?? ""} ${centre.ville}<br>` +
              `<span style="opacity:.7">${centre.totalFormations} formation${
                centre.totalFormations > 1 ? "s" : ""
              } · ${formatDistance(centre.distanceKm)}</span>`
          )
          .addTo(couche.current!);
        marqueurs.current.set(centre.id, repere);
      }

      // Recadrage seulement si le disque a bougé : sinon on écraserait le
      // déplacement que le visiteur vient de faire — molette comprise.
      const cadrage = `${depart.latitude},${depart.longitude},${rayonDessine}`;
      if (dernierCadrage.current !== cadrage) {
        dernierCadrage.current = cadrage;
        c.fitBounds(cercle.current.getBounds(), { padding: [24, 24] });
      }

      // Les repères sont en place : on peut enfin rouvrir la bulle demandée, et
      // amener la carte dessus si la demande venait de la liste.
      const suite = apresDessin.current;
      apresDessin.current = null;
      if (suite) {
        const centre = resultats.find((r) => r.id === suite.centreId);
        if (centre && suite.recentrer) {
          // On garde le niveau de zoom courant s'il est déjà serré : quelqu'un
          // qui a zoomé à la molette ne veut pas être ramené en arrière.
          c.setView([centre.latitude, centre.longitude], Math.max(c.getZoom(), 12));
        }
        marqueurs.current.get(suite.centreId)?.openPopup();
      }
    })();

    return () => {
      annule = true;
    };
  }, [depart, resultats, rayonDessine, choisi, choisirDepuisCarte]);

  useEffect(() => {
    return () => {
      carte.current?.remove();
      carte.current = null;
    };
  }, []);

  const champ =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const etiquette = "block text-xs font-medium text-zinc-500";

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={soumettreAdresse}
        className="flex flex-wrap gap-2"
      >
        <label htmlFor={idAdresse} className="sr-only">
          Adresse de l&apos;entreprise
        </label>
        <div className="min-w-0 flex-1">
          <ChampAdresse
            id={idAdresse}
            valeur={adresse}
            onChange={setAdresse}
            onChoisir={choisirSuggestion}
            placeholder="Adresse de l'entreprise — 12 rue de la Paix, 35000 Rennes"
          />
        </div>
        <button
          type="submit"
          disabled={situation}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {situation ? "Recherche…" : "Situer"}
        </button>
      </form>

      {erreur && (
        <p role="alert" className="text-sm text-red-600">
          {erreur}
        </p>
      )}

      {/* Les filtres restent affichés avant même qu'une adresse soit posée :
          on voit tout de suite de quoi on dispose. Ils ne déclenchent
          simplement rien tant qu'il n'y a pas de point de départ. */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <label htmlFor="carte-q" className={etiquette}>
            Mot-clé
          </label>
          <input
            id="carte-q"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Intitulé, description…"
            className={champ}
          />
        </div>

        <div>
          <label htmlFor="carte-domaine" className={etiquette}>
            Domaine
          </label>
          <select
            id="carte-domaine"
            value={domaineId}
            onChange={(e) => setDomaineId(e.target.value)}
            className={champ}
          >
            <option value="">Tous</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="carte-organisme" className={etiquette}>
            Organisme
          </label>
          <select
            id="carte-organisme"
            value={organismeId}
            onChange={(e) => setOrganismeId(e.target.value)}
            className={champ}
          >
            <option value="">Tous</option>
            {organismes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={idRayon} className={etiquette}>
              Rayon
            </label>
            <span className="text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
              {rayon} km
            </span>
          </div>
          <input
            id={idRayon}
            type="range"
            min={RAYON_PAS}
            max={RAYON_MAX}
            step={RAYON_PAS}
            value={rayon}
            onChange={(e) => setRayon(Number(e.target.value))}
            className="mt-3 w-full cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="carte-du" className={etiquette}>
            Du
          </label>
          <input
            id="carte-du"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={champ}
          />
        </div>

        <div>
          <label htmlFor="carte-au" className={etiquette}>
            Au
          </label>
          <input
            id="carte-au"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={champ}
          />
        </div>

        <div className="flex flex-col justify-end gap-2 text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={permanentes}
              onChange={(e) => setPermanentes(e.target.checked)}
            />
            Sessions à entrée permanente
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={passees}
              onChange={(e) => setPassees(e.target.checked)}
            />
            Inclure les sessions passées
          </label>
        </div>
      </div>

      {!depart ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Indiquez l&apos;adresse de l&apos;entreprise : la carte affichera les
          centres alentour et ce qui s&apos;y donne.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {nombre.format(totaux.formations)}
              </span>{" "}
              formation{totaux.formations > 1 ? "s" : ""} dans{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {resultats.length}
              </span>{" "}
              centre{resultats.length > 1 ? "s" : ""} à moins de{" "}
              <span className="tabular-nums">{rayonDessine} km</span>
              {" · "}
              {nombre.format(totaux.sessions)} session
              {totaux.sessions > 1 ? "s" : ""}
              {chargement && <span className="text-zinc-400"> · mise à jour…</span>}
            </p>
            <p className="text-xs text-zinc-400">
              Départ : {depart.libelle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
            <div className="order-2 flex max-h-[34rem] flex-col gap-2 overflow-y-auto lg:order-1">
              {resultats.length === 0 ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  {centresDansRayon > 0 ? (
                    // Des centres existent ici, mais rien n'y correspond : le
                    // geste à faire est de relâcher un filtre, pas d'élargir.
                    <>
                      {centresDansRayon} centre{centresDansRayon > 1 ? "s" : ""} dans
                      ce rayon, mais aucun ne propose de formation correspondant à
                      ces filtres.
                    </>
                  ) : (
                    <>
                      Aucun centre à moins de {rayonDessine} km.
                      {plusProche && (
                        <>
                          {" "}
                          Le plus proche est{" "}
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {plusProche.organismeNom} — {plusProche.ville}
                          </span>
                          , à {formatDistance(plusProche.distanceKm)}.
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : (
                resultats.map((centre) => (
                  <FicheCentre
                    key={centre.id}
                    centre={centre}
                    ouvert={choisi === centre.id}
                    onBascule={() =>
                      choisirDepuisListe(choisi === centre.id ? null : centre.id)
                    }
                    onCorrige={() => setRechargements((n) => n + 1)}
                  />
                ))
              )}
            </div>

            <div
              ref={conteneur}
              className="carte-site order-1 h-[26rem] overflow-hidden rounded-lg border border-zinc-200 lg:order-2 lg:h-[34rem] dark:border-zinc-800"
            />
          </div>

          <p className="text-right text-xs text-zinc-400">
            Distances à vol d&apos;oiseau. Fond de carte OpenStreetMap.
          </p>
        </>
      )}
    </div>
  );
}

function FicheCentre({
  centre,
  ouvert,
  onBascule,
  onCorrige,
}: {
  centre: CentreResultat;
  ouvert: boolean;
  onBascule: () => void;
  /** Recharger la recherche : le repère a bougé. */
  onCorrige: () => void;
}) {
  return (
    <div
      id={`centre-${centre.id}`}
      // La bordure de la fiche ouverte reprend la couleur de son repère sur la
      // carte : c'est ce qui relie la liste et la carte du regard.
      className={`rounded-md border text-sm ${
        ouvert
          ? "border-orange-600 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <button
        type="button"
        onClick={onBascule}
        aria-expanded={ouvert}
        className="block w-full px-4 py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{centre.organismeNom}</span>
          <span className="shrink-0 tabular-nums text-xs text-zinc-500">
            {formatDistance(centre.distanceKm)}
          </span>
        </div>
        {/* L'adresse de rue si on l'a — sinon la commune seule, ce qui reste la
            majorité des cas : les organismes ne publient pas leur adresse dans
            leur calendrier, et c'est au back office de la compléter. */}
        {centre.adresse && (
          <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {centre.adresse}
          </div>
        )}
        <div className="mt-0.5 text-xs text-zinc-500">
          {centre.codePostal ? `${centre.codePostal} ` : ""}
          {centre.ville} · {centre.totalFormations} formation
          {centre.totalFormations > 1 ? "s" : ""} · {centre.totalSessions} session
          {centre.totalSessions > 1 ? "s" : ""}
        </div>
      </button>

      {ouvert && (
        <ul className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          {centre.formations.map((f) => (
            <li key={f.id} className="border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800">
              <Link
                href={`/formations/${f.id}`}
                className="font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {f.intitule}
              </Link>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                {f.domaineNom && <span>{f.domaineNom}</span>}
                <span>
                  {f.prochaine
                    ? `Prochaine : ${formatDateCourt(new Date(f.prochaine))}`
                    : "Entrée/sortie permanente"}
                </span>
                <span>
                  {f.sessions} session{f.sessions > 1 ? "s" : ""} ici
                </span>
              </div>
            </li>
          ))}
          {centre.totalFormations > centre.formations.length && (
            <li className="py-2 text-xs text-zinc-500">
              … et {centre.totalFormations - centre.formations.length} autre
              {centre.totalFormations - centre.formations.length > 1 ? "s" : ""} :
              resserrez les filtres pour les voir.
            </li>
          )}
        </ul>
      )}

      {ouvert && <CorrectionAdresse centre={centre} onCorrige={onCorrige} />}
    </div>
  );
}

/**
 * « L'adresse est fausse » — et on peut la réparer, sans compte.
 *
 * Le back office reste le lieu du travail de fond ; ceci est le geste de
 * passage, fait par celui qui vient de constater l'erreur au téléphone. C'est
 * pourquoi il est ici, sur la carte, et non derrière une authentification.
 *
 * L'enregistrement n'est possible qu'avec une adresse CHOISIE dans les
 * suggestions : ses coordonnées sont alors connues, donc l'adresse existe et le
 * repère se déplace tout de suite. Du texte libre serait invérifiable, et c'est
 * précisément ce qu'on ne veut pas laisser écrire sans compte.
 */
function CorrectionAdresse({
  centre,
  onCorrige,
}: {
  centre: CentreResultat;
  onCorrige: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState(
    centre.adresse
      ? [centre.adresse, [centre.codePostal, centre.ville].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", ")
      : centre.ville
  );
  const [choix, setChoix] = useState<Suggestion | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enregistrer() {
    if (!choix?.latitude || !choix.longitude) return;
    setEnvoi(true);
    setMessage(null);
    const resultat = await corrigerAdresseCentre({
      centreId: centre.id,
      adresse: choix.rue,
      codePostal: choix.codePostal,
      ville: choix.ville ?? centre.ville,
      latitude: choix.latitude,
      longitude: choix.longitude,
      libelle: choix.libelle,
    });
    setEnvoi(false);
    if (resultat.ok) {
      setOuvert(false);
      setChoix(null);
      onCorrige();
    } else {
      setMessage(resultat.erreur);
    }
  }

  if (!ouvert) {
    return (
      <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          {centre.adresse
            ? "Corriger l'adresse de ce centre"
            : "Préciser l'adresse de ce centre"}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">
        Cherchez l&apos;adresse et choisissez-la dans la liste : le centre sera
        déplacé sur la carte. Aucun compte n&apos;est nécessaire.
      </p>
      <div className="mt-2">
        <ChampAdresse
          valeur={saisie}
          onChange={(texte) => {
            setSaisie(texte);
            // Saisie manuelle : plus de position vérifiée, donc plus
            // d'enregistrement possible.
            setChoix(null);
          }}
          onChoisir={(suggestion) => {
            setSaisie(suggestion.libelle);
            setChoix(suggestion);
          }}
          placeholder="12 rue de la Paix, 35000 Rennes"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enregistrer}
          disabled={!choix?.latitude || envoi}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {envoi ? "Enregistrement…" : "Enregistrer cette adresse"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setChoix(null);
            setMessage(null);
          }}
          className="text-xs text-zinc-500 hover:underline"
        >
          Annuler
        </button>
        {!choix && !message && (
          <span className="text-xs text-zinc-400">
            Choisissez une adresse dans la liste pour pouvoir enregistrer.
          </span>
        )}
        {message && <span className="text-xs text-red-600">{message}</span>}
      </div>
    </div>
  );
}
