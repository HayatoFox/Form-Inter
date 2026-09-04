import "server-only";
import { prisma } from "@/lib/prisma";
import { geocoder } from "@/lib/geo/nominatim";
import { boiteEnglobante, distanceKm, type Point } from "@/lib/geo/distance";

/**
 * La localisation des centres de formation.
 *
 * Un centre est géocodé UNE FOIS puis conservé : son adresse ne bouge
 * pratiquement jamais, et c'est ce qui rend tout le reste du dispositif sobre.
 * Une fois cette table remplie, filtrer par distance ou dessiner une carte ne
 * coûte plus une seule requête à OpenStreetMap.
 */

/**
 * De la plus précise à la plus grossière. Un centre dont l'adresse de rue
 * n'est pas reconnue vaut mieux positionné sur sa commune que pas positionné
 * du tout : à l'échelle d'un rayon de trente kilomètres, le centre-ville de
 * Cesson-Sévigné est une réponse juste.
 */
function tentatives(centre: {
  adresse: string | null;
  codePostal: string | null;
  ville: string;
}): string[] {
  const ville = centre.ville.trim();
  const cp = centre.codePostal?.trim();
  const rue = centre.adresse?.trim();

  const liste = [
    rue && cp ? `${rue}, ${cp} ${ville}, France` : null,
    rue ? `${rue}, ${ville}, France` : null,
    cp ? `${cp} ${ville}, France` : null,
    ville ? `${ville}, France` : null,
  ].filter((v): v is string => Boolean(v));

  return [...new Set(liste)];
}

export type CompteRenduGeo = {
  traites: number;
  localises: number;
  introuvables: number;
  erreurs: number;
  restants: number;
};

/**
 * Localise les centres qui ne le sont pas encore.
 *
 * Le lot est borné : à une requête par seconde, cinquante centres prennent une
 * minute. Mieux vaut plusieurs passages courts qu'un seul qui monopolise la
 * cadence pendant un quart d'heure — et le prochain appel reprend là où on en
 * était, puisque l'état vit en base.
 *
 * Les centres en « erreur » sont repris au passage suivant (panne réseau,
 * service momentanément indisponible), ceux en « introuvable » ne le sont pas :
 * réinterroger indéfiniment une adresse que le service ne connaît pas est
 * précisément l'usage qui fait bannir.
 */
export async function localiserCentres(
  options: { lot?: number; reprendreEchecs?: boolean } = {}
): Promise<CompteRenduGeo> {
  const lot = Math.min(Math.max(options.lot ?? 50, 1), 200);
  const statuts = options.reprendreEchecs
    ? ["attente", "erreur", "introuvable"]
    : ["attente", "erreur"];

  const aFaire = await prisma.centre.findMany({
    where: { geoStatut: { in: statuts } },
    orderBy: { nom: "asc" },
    take: lot,
  });

  const rendu: CompteRenduGeo = {
    traites: 0,
    localises: 0,
    introuvables: 0,
    erreurs: 0,
    restants: 0,
  };

  for (const centre of aFaire) {
    rendu.traites += 1;
    let pose = false;

    for (const requete of tentatives(centre)) {
      const resultat = await geocoder(requete, {
        genre: "centre",
        forcer: options.reprendreEchecs && centre.geoStatut === "introuvable",
      });

      if (resultat.trouve) {
        await prisma.centre.update({
          where: { id: centre.id },
          data: {
            latitude: resultat.coordonnees.latitude,
            longitude: resultat.coordonnees.longitude,
            geoStatut: "ok",
            geoRequete: requete,
            geoLibelle: resultat.coordonnees.libelle,
            geoLe: new Date(),
          },
        });
        rendu.localises += 1;
        pose = true;
        break;
      }

      // Sur une panne ou un plafond, on s'arrête là pour ce centre : essayer
      // les requêtes de repli ne ferait qu'ajouter des appels condamnés.
      if (resultat.raison !== "introuvable") {
        await prisma.centre.update({
          where: { id: centre.id },
          data: { geoStatut: "erreur", geoLe: new Date() },
        });
        rendu.erreurs += 1;
        pose = true;
        break;
      }
    }

    if (!pose) {
      await prisma.centre.update({
        where: { id: centre.id },
        data: { geoStatut: "introuvable", geoLe: new Date() },
      });
      rendu.introuvables += 1;
    }
  }

  rendu.restants = await prisma.centre.count({
    where: { geoStatut: { in: ["attente", "erreur"] } },
  });

  return rendu;
}

export async function etatLocalisation() {
  const [total, ok, attente, introuvables, erreurs] = await Promise.all([
    prisma.centre.count(),
    prisma.centre.count({ where: { geoStatut: "ok" } }),
    prisma.centre.count({ where: { geoStatut: "attente" } }),
    prisma.centre.count({ where: { geoStatut: "introuvable" } }),
    prisma.centre.count({ where: { geoStatut: "erreur" } }),
  ]);
  return { total, ok, attente, introuvables, erreurs };
}

export type CentreSitue = {
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

/**
 * Les centres dans un rayon donné. Aucun appel réseau : la boîte englobante
 * dégrossit en base sur les colonnes indexées, la distance exacte tranche
 * ensuite sur le peu qui reste.
 */
export async function centresAutour(
  point: Point,
  rayonKm: number,
  options: { formationId?: string; limite?: number } = {}
): Promise<CentreSitue[]> {
  const boite = boiteEnglobante(point, rayonKm);

  // Le critère est « ce centre a des coordonnées », pas « son statut est ok ».
  // La nuance compte depuis qu'on peut corriger une adresse au back office :
  // le centre repasse alors en file de géocodage, et le filtrer sur son statut
  // le faisait DISPARAÎTRE de la carte jusqu'au passage suivant. Renseigner une
  // adresse plus précise ne doit pas faire perdre le centre ; ses coordonnées
  // d'avant restent la meilleure réponse disponible en attendant l'affinage.
  const candidats = await prisma.centre.findMany({
    where: {
      latitude: { gte: boite.latMin, lte: boite.latMax },
      longitude: { gte: boite.lonMin, lte: boite.lonMax },
      ...(options.formationId && {
        sessions: { some: { formationId: options.formationId } },
      }),
    },
    select: {
      id: true,
      nom: true,
      ville: true,
      codePostal: true,
      adresse: true,
      latitude: true,
      longitude: true,
      organismeId: true,
      organisme: { select: { nom: true } },
    },
  });

  return candidats
    .flatMap((c) => {
      if (c.latitude === null || c.longitude === null) return [];
      const d = distanceKm(point, { latitude: c.latitude, longitude: c.longitude });
      if (d > rayonKm) return [];
      return [
        {
          id: c.id,
          nom: c.nom,
          ville: c.ville,
          codePostal: c.codePostal,
          adresse: c.adresse,
          latitude: c.latitude,
          longitude: c.longitude,
          organismeId: c.organismeId,
          organismeNom: c.organisme.nom,
          distanceKm: d,
        },
      ];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, options.limite ?? 300);
}

/**
 * Le centre le plus proche, sans limite de distance.
 *
 * Il ne sert qu'à un cas : le rayon ne ramène rien. Un disque vide ne dit pas
 * si la formation ne se donne nulle part alentour ou si le curseur est trop
 * serré — et sur un catalogue national, c'est la seconde réponse neuf fois sur
 * dix. Autant dire jusqu'où il faudrait aller. Toujours aucun appel réseau :
 * une lecture de la table des centres.
 */
export async function centreLePlusProche(
  point: Point,
  options: { formationId?: string } = {}
): Promise<CentreSitue | null> {
  const candidats = await prisma.centre.findMany({
    where: {
      // Même critère que `centresAutour` : des coordonnées, quel que soit le
      // statut de fraîcheur.
      NOT: { latitude: null },
      ...(options.formationId && {
        sessions: { some: { formationId: options.formationId } },
      }),
    },
    select: {
      id: true,
      nom: true,
      ville: true,
      codePostal: true,
      adresse: true,
      latitude: true,
      longitude: true,
      organismeId: true,
      organisme: { select: { nom: true } },
    },
  });

  let meilleur: CentreSitue | null = null;
  for (const c of candidats) {
    if (c.latitude === null || c.longitude === null) continue;
    const d = distanceKm(point, { latitude: c.latitude, longitude: c.longitude });
    if (meilleur && d >= meilleur.distanceKm) continue;
    meilleur = {
      id: c.id,
      nom: c.nom,
      ville: c.ville,
      codePostal: c.codePostal,
      adresse: c.adresse,
      latitude: c.latitude,
      longitude: c.longitude,
      organismeId: c.organismeId,
      organismeNom: c.organisme.nom,
      distanceKm: d,
    };
  }
  return meilleur;
}

/**
 * Coordonnées d'une ville du catalogue, sans sortir sur le réseau si un centre
 * de cette ville est déjà localisé — le cas de très loin le plus fréquent,
 * puisque les villes proposées dans le filtre viennent justement des centres.
 */
export async function positionVille(ville: string): Promise<Point | null> {
  const dejaConnu = await prisma.centre.findFirst({
    where: { ville, geoStatut: "ok" },
    select: { latitude: true, longitude: true },
  });
  if (dejaConnu?.latitude != null && dejaConnu.longitude != null) {
    return { latitude: dejaConnu.latitude, longitude: dejaConnu.longitude };
  }

  const resultat = await geocoder(`${ville}, France`, { genre: "ville" });
  return resultat.trouve
    ? {
        latitude: resultat.coordonnees.latitude,
        longitude: resultat.coordonnees.longitude,
      }
    : null;
}
