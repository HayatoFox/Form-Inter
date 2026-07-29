import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MANUEL } from "@/lib/backend/types";
import { importRowSchema, type ImportRow } from "@/lib/validation";

type RowResult =
  | { status: "ok"; sessionCreated: boolean }
  | { status: "error"; message: string };

// Les lignes importées portent source = MANUEL : la synchronisation avec le
// backend ne les touche jamais. Symétriquement, un import ne modifie pas une
// session déjà rapatriée du backend — il se contente de ne pas la dupliquer.
async function processRow(data: ImportRow): Promise<RowResult> {
  const organisme = await prisma.organisme.upsert({
    where: { nom: data.organisme },
    update: {},
    create: { nom: data.organisme, source: MANUEL },
  });

  let domaineId: string | undefined;
  if (data.domaine) {
    const domaine = await prisma.domaine.upsert({
      where: { nom: data.domaine },
      update: {},
      create: { nom: data.domaine, source: MANUEL },
    });
    domaineId = domaine.id;
  }

  let centreId: string | undefined;
  const centreNom = data.centre || data.ville;
  if (centreNom && data.ville) {
    const centre = await prisma.centre.upsert({
      where: {
        organismeId_nom: { organismeId: organisme.id, nom: centreNom },
      },
      update: { ville: data.ville },
      create: {
        nom: centreNom,
        ville: data.ville,
        organismeId: organisme.id,
        source: MANUEL,
      },
    });
    centreId = centre.id;
  }

  const formation = await prisma.formation.upsert({
    where: {
      organismeId_intitule: {
        organismeId: organisme.id,
        intitule: data.intitule,
      },
    },
    update: {
      description: data.description || undefined,
      dureeValeur: data.dureeValeur ?? undefined,
      dureeUnite: data.dureeUnite || undefined,
      typeFormation: data.typeFormation || undefined,
      urlProgramme: data.urlProgramme || undefined,
      domaineId: domaineId ?? undefined,
    },
    create: {
      intitule: data.intitule,
      organismeId: organisme.id,
      description: data.description || null,
      dureeValeur: data.dureeValeur ?? null,
      dureeUnite: data.dureeUnite || null,
      typeFormation: data.typeFormation || null,
      urlProgramme: data.urlProgramme || null,
      domaineId: domaineId ?? null,
      source: MANUEL,
    },
  });

  let sessionCreated = false;
  if (data.dateDebut) {
    const existing = await prisma.session.findFirst({
      where: {
        formationId: formation.id,
        centreId: centreId ?? null,
        dateDebut: data.dateDebut,
      },
      select: { id: true, source: true },
    });

    const champsSession = {
      dateFin: data.dateFin ?? null,
      tarif: data.tarif || null,
      placesInfo: data.placesInfo || null,
      remarque: data.remarque || null,
      urlProgramme: data.urlProgramme || null,
    };

    if (!existing) {
      await prisma.session.create({
        data: {
          formationId: formation.id,
          centreId: centreId ?? null,
          dateDebut: data.dateDebut,
          source: MANUEL,
          ...champsSession,
        },
      });
      sessionCreated = true;
    } else if (existing.source === MANUEL) {
      // Réimport du même fichier corrigé : la ligne manuelle est rafraîchie.
      await prisma.session.update({
        where: { id: existing.id },
        data: champsSession,
      });
    }
  }

  return { status: "ok", sessionCreated };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : null;

  if (!rows) {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 }
    );
  }

  let processed = 0;
  let sessionsCreated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = importRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push({
        row: i + 1,
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      continue;
    }

    try {
      const result = await processRow(parsed.data);
      processed += 1;
      if (result.status === "ok" && result.sessionCreated) sessionsCreated += 1;
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  if (processed > 0) {
    revalidatePath("/formations");
    revalidatePath("/organismes");
    revalidatePath("/admin/formations");
    revalidatePath("/admin/organismes");
    revalidatePath("/admin/domaines");
    revalidatePath("/admin/sources");
  }

  return NextResponse.json({
    total: rows.length,
    processed,
    sessionsCreated,
    errors,
  });
}
