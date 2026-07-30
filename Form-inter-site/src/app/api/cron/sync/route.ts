import { NextRequest, NextResponse } from "next/server";
import { synchroniser } from "@/lib/backend/sync";
import { revaliderCatalogue } from "@/lib/revalidation";

// Déclenchement de la synchronisation depuis un ordonnanceur (cron système,
// tâche planifiée de l'hébergeur…) :
//
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/sync
//
// Ce chemin n'est pas couvert par le proxy d'authentification du back office :
// il porte sa propre protection par jeton, et reste fermé tant que CRON_SECRET
// n'est pas défini.

export const dynamic = "force-dynamic";

function autorise(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const entete = request.headers.get("authorization") ?? "";
  return entete === `Bearer ${secret}`;
}

async function traiter(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET n'est pas défini : endpoint désactivé" },
      { status: 503 }
    );
  }
  if (!autorise(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const resultat = await synchroniser("cron");
  if (resultat.statut === "ok") revaliderCatalogue();

  return NextResponse.json(resultat, {
    status: resultat.statut === "erreur" ? 502 : 200,
  });
}

export async function GET(request: NextRequest) {
  return traiter(request);
}

export async function POST(request: NextRequest) {
  return traiter(request);
}
