/**
 * Géométrie sur la sphère. Aucun appel réseau ici : une fois les coordonnées
 * connues, toutes les distances du site se calculent localement.
 *
 * Les distances affichées sont à VOL D'OISEAU, et le site le dit partout où
 * il en montre une. Une distance routière demanderait un service de calcul
 * d'itinéraire ; le serveur public de démonstration d'OSRM interdit
 * explicitement l'usage en production, et en héberger un pour cinq organismes
 * serait disproportionné. Mieux vaut un chiffre honnête et clairement nommé
 * qu'un chiffre routier obtenu en violant les conditions d'un service tiers.
 */

export type Point = { latitude: number; longitude: number };

const RAYON_TERRE_KM = 6371.0088;

const rad = (degres: number) => (degres * Math.PI) / 180;

/** Distance à vol d'oiseau entre deux points, en kilomètres. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(h));
}

/**
 * Boîte englobante d'un disque, pour dégrossir en base avant le calcul exact.
 *
 * Un `BETWEEN` sur deux colonnes indexées écarte l'essentiel des centres sans
 * trigonométrie ; la distance exacte ne s'applique ensuite qu'aux survivants.
 * La boîte est toujours plus large que le disque, donc elle ne perd jamais un
 * résultat — elle en laisse simplement passer quelques-uns en trop.
 */
export function boiteEnglobante(
  centre: Point,
  rayonKm: number
): { latMin: number; latMax: number; lonMin: number; lonMax: number } {
  const dLat = rayonKm / 111.32;

  // Un degré de longitude rétrécit avec la latitude. Le garde-fou évite une
  // division par ~0 près des pôles ; en France métropolitaine on est loin du
  // cas, mais une boîte infinie serait un joli piège pour plus tard.
  const cos = Math.cos(rad(centre.latitude));
  const dLon = rayonKm / (111.32 * Math.max(0.01, cos));

  return {
    latMin: centre.latitude - dLat,
    latMax: centre.latitude + dLat,
    lonMin: centre.longitude - dLon,
    lonMax: centre.longitude + dLon,
  };
}

/** « 12 km », « 3,4 km », « 800 m ». */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}
