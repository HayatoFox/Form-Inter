import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centreLePlusProche, centresAutour } from "@/lib/geo/centres";
import { normaliserRayon } from "@/lib/geo/rayon";
import { construireFiltres, lireCriteresURL } from "@/lib/recherche";

/**
 * La recherche de la carte : « qu'est-ce qui se donne autour de mon client,
 * et où exactement ? »
 *
 * C'est la seule route que la page `/carte` interroge une fois l'adresse
 * résolue. Elle est appelée à CHAQUE frappe dans le champ mot-clé et à chaque
 * mouvement du curseur de rayon, ce qui impose deux choses :
 *
 * - aucun appel réseau sortant. Les centres sont déjà localisés en base, le
 *   disque se calcule ici, et OpenStreetMap n'est jamais sollicité — seule la
 *   résolution de l'adresse du client, faite une fois par `/api/geo/adresse`,
 *   peut lui coûter une requête ;
 * - un regroupement fait en base et non en JavaScript. On ne rapatrie pas les
 *   sessions une à une : un `groupBy` par centre et par formation rend
 *   directement le nombre de sessions et la prochaine date, et le volume de la
 *   réponse suit le nombre de couples (centre, formation), pas celui des
 *   sessions.
 */

export const dynamic = "force-dynamic";

// Une carte montre des dizaines de repères, pas des milliers.
const CENTRES_MAX = 200;
// Au-delà, la colonne de résultats n'est plus lisible : on annonce le total et
// on laisse le visiteur resserrer ses critères.
const FORMATIONS_PAR_CENTRE = 60;

export type FormationCarte = {
  id: string;
  intitule: string;
  organismeNom: string;
  domaineNom: string | null;
  /** Nombre de sessions correspondant aux filtres, dans ce centre. */
  sessions: number;
  /** Prochaine date retenue, ou null si l'offre est à entrée permanente. */
  prochaine: string | null;
};

export type CentreCarteResultat = {
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
  /** Total avant troncature de la liste ci-dessus. */
  totalFormations: number;
  totalSessions: number;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  const rayon = normaliserRayon(params.get("rayon")) || 50;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return NextResponse.json({ erreur: "Point invalide." }, { status: 400 });
  }

  const point = { latitude, longitude };
  const criteres = lireCriteresURL(params);

  const centres = await centresAutour(point, rayon, { limite: CENTRES_MAX });

  if (centres.length === 0) {
    // Aucun centre dans le disque : on dit jusqu'où il faudrait aller, plutôt
    // que de rendre une carte vide sans explication.
    return NextResponse.json({
      rayon,
      centres: [],
      centresDansRayon: 0,
      totalCentres: 0,
      totalFormations: 0,
      totalSessions: 0,
      plusProche: await centreLePlusProche(point),
    });
  }

  const parId = new Map(centres.map((c) => [c.id, c]));
  const { sessionFilter, formationFilter } = construireFiltres(criteres, {
    centreId: { in: centres.map((c) => c.id) },
  });

  // Un couple (centre, formation) par ligne : combien de sessions, et la
  // première date. `_min` ignore les NULL, donc une date nulle ici signifie
  // « que des sessions à entrée permanente ».
  const groupes = await prisma.session.groupBy({
    by: ["centreId", "formationId"],
    where: { ...sessionFilter, formation: formationFilter },
    _count: { _all: true },
    _min: { dateDebut: true },
  });

  const formationIds = [...new Set(groupes.map((g) => g.formationId))];
  const formations = await prisma.formation.findMany({
    where: { id: { in: formationIds } },
    select: {
      id: true,
      intitule: true,
      organisme: { select: { nom: true } },
      domaine: { select: { nom: true } },
    },
  });
  const formationParId = new Map(formations.map((f) => [f.id, f]));

  const parCentre = new Map<string, FormationCarte[]>();
  let totalSessions = 0;

  for (const groupe of groupes) {
    if (!groupe.centreId) continue;
    const formation = formationParId.get(groupe.formationId);
    if (!formation) continue;

    totalSessions += groupe._count._all;
    const liste = parCentre.get(groupe.centreId) ?? [];
    liste.push({
      id: formation.id,
      intitule: formation.intitule,
      organismeNom: formation.organisme.nom,
      domaineNom: formation.domaine?.nom ?? null,
      sessions: groupe._count._all,
      prochaine: groupe._min.dateDebut?.toISOString() ?? null,
    });
    parCentre.set(groupe.centreId, liste);
  }

  const resultats: CentreCarteResultat[] = [];
  for (const [centreId, liste] of parCentre) {
    const centre = parId.get(centreId);
    if (!centre) continue;

    // Les dates d'abord, l'offre permanente ensuite : c'est l'ordre dans lequel
    // on lit un calendrier.
    liste.sort((a, b) => {
      if (a.prochaine && b.prochaine) return a.prochaine.localeCompare(b.prochaine);
      if (a.prochaine) return -1;
      if (b.prochaine) return 1;
      return a.intitule.localeCompare(b.intitule, "fr");
    });

    resultats.push({
      ...centre,
      formations: liste.slice(0, FORMATIONS_PAR_CENTRE),
      totalFormations: liste.length,
      totalSessions: liste.reduce((n, f) => n + f.sessions, 0),
    });
  }

  resultats.sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json({
    rayon,
    centres: resultats,
    // Deux compteurs, et la distinction n'est pas cosmétique : « aucun centre à
    // moins de 30 km » et « quatre centres, mais aucun ne donne ça » appellent
    // des gestes différents — élargir le rayon, ou relâcher les filtres. Le
    // centre le plus proche ne répond qu'à la première question, et l'annoncer
    // dans la seconde ferait espérer une formation qu'il ne propose pas.
    centresDansRayon: centres.length,
    totalCentres: resultats.length,
    // Une même formation peut être proposée par plusieurs centres du disque :
    // le total dédoublonne, les compteurs par repère non.
    totalFormations: formationIds.length,
    totalSessions,
    plusProche: null,
  });
}
