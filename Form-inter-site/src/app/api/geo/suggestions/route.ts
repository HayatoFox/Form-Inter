import { NextRequest, NextResponse } from "next/server";
import { suggererAdresses } from "@/lib/geo/adresses";

/**
 * Les adresses déjà connues, proposées pendant la frappe.
 *
 * Aucune sortie réseau : c'est une lecture de notre base. C'est même l'inverse
 * d'une dépense — une suggestion issue du cache de géocodage est une adresse
 * dont la position est déjà connue, donc une recherche qui ne coûtera rien à
 * OpenStreetMap.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const saisie = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (saisie.length < 2) return NextResponse.json({ suggestions: [] });
  // Une saisie démesurée n'est pas un début d'adresse.
  if (saisie.length > 200) return NextResponse.json({ suggestions: [] });

  return NextResponse.json({ suggestions: await suggererAdresses(saisie) });
}
