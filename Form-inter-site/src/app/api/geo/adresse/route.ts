import { NextRequest, NextResponse } from "next/server";
import { geocoder } from "@/lib/geo/nominatim";
import { centreLePlusProche, centresAutour } from "@/lib/geo/centres";
import { normaliserRayon } from "@/lib/geo/rayon";

/**
 * Résout l'adresse d'un client et rend les centres qui l'entourent.
 *
 * Une seule route pour les deux, volontairement : c'est toujours la même
 * question — « où est mon client, et qui forme autour de lui ? » — et le
 * navigateur n'a donc qu'un aller-retour à faire pour l'ouverture de la carte.
 *
 * Un seul appel réseau vers OpenStreetMap peut en sortir, et seulement si
 * l'adresse n'a jamais été demandée : le géocodeur passe par le cache en base.
 * Les centres, eux, sont déjà localisés et ne coûtent qu'une requête SQL —
 * bouger le curseur de rayon ne sollicite jamais OpenStreetMap.
 */

export const dynamic = "force-dynamic";

// Une carte affiche des dizaines de repères, pas des milliers : au-delà, la
// réponse pèse plus que ce qu'un écran peut montrer utilement.
const CENTRES_MAX = 200;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const adresse = (params.get("adresse") ?? "").trim();
  const rayon = normaliserRayon(params.get("rayon")) || 50;
  const formationId = params.get("formation") ?? undefined;

  if (adresse.length < 3) {
    return NextResponse.json(
      { erreur: "Indiquez une adresse, un code postal ou une ville." },
      { status: 400 }
    );
  }
  // Une saisie démesurée n'est pas une adresse : on la refuse avant d'occuper
  // la file du géocodeur.
  if (adresse.length > 200) {
    return NextResponse.json({ erreur: "Adresse trop longue." }, { status: 400 });
  }

  const resultat = await geocoder(adresse, { genre: "client" });

  if (!resultat.trouve) {
    const message =
      resultat.raison === "plafond"
        ? "Trop de recherches d'adresse en cours. Réessayez dans quelques minutes."
        : resultat.raison === "erreur"
          ? "Le service d'adresses est momentanément indisponible."
          : "Adresse introuvable. Essayez avec le code postal ou la ville.";
    return NextResponse.json(
      { erreur: message, raison: resultat.raison },
      { status: resultat.raison === "introuvable" ? 404 : 503 }
    );
  }

  const point = {
    latitude: resultat.coordonnees.latitude,
    longitude: resultat.coordonnees.longitude,
  };

  const centres = await centresAutour(point, rayon, {
    formationId,
    limite: CENTRES_MAX,
  });

  // Rien dans le rayon : on indique jusqu'où il faudrait aller, plutôt que de
  // rendre une carte vide sans explication.
  const plusProche =
    centres.length === 0 ? await centreLePlusProche(point, { formationId }) : null;

  return NextResponse.json({
    depart: { ...point, libelle: resultat.coordonnees.libelle },
    depuisCache: resultat.depuisCache,
    rayon,
    centres,
    plusProche,
  });
}
