import { NextRequest, NextResponse } from "next/server";
import { centreLePlusProche, centresAutour } from "@/lib/geo/centres";
import { normaliserRayon } from "@/lib/geo/rayon";

/**
 * Les centres autour d'un point déjà connu.
 *
 * C'est la route qu'appelle le curseur de rayon de la carte : le point de
 * départ a été résolu une fois à la saisie de l'adresse, et l'élargir ne
 * regarde plus que la base. Zéro appel à OpenStreetMap, quel que soit le
 * nombre de fois qu'on fait glisser le curseur.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  const rayon = normaliserRayon(params.get("rayon")) || 50;
  const formationId = params.get("formation") ?? undefined;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return NextResponse.json({ erreur: "Point invalide." }, { status: 400 });
  }

  const point = { latitude, longitude };
  const centres = await centresAutour(point, rayon, { formationId, limite: 200 });
  const plusProche =
    centres.length === 0 ? await centreLePlusProche(point, { formationId }) : null;

  return NextResponse.json({ rayon, centres, plusProche });
}
