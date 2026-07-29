import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

const MAX_ROWS = 6000;

function toColumnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

// Construit des en-têtes uniques et non vides, et convertit chaque ligne en
// objet indexé sur ces mêmes en-têtes (par position). Cela évite les
// incohérences de sheet_to_json en mode objet (clés "__EMPTY" générées pour
// les colonnes sans en-tête, non-trim des espaces, collisions d'en-têtes
// dupliqués) qui désynchronisaient la liste des en-têtes affichée du contenu
// réel des lignes.
function buildHeadersAndRows(sheet: XLSX.WorkSheet) {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });
  const rawHeaders = (raw[0] ?? []).map((h) => String(h ?? "").trim());

  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    let label = h || `Colonne ${toColumnLetter(i)}`;
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    if (count > 0) label = `${label} (${count + 1})`;
    return label;
  });

  const rows = raw
    .slice(1)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? "";
      });
      return obj;
    });

  return { headers, rows };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  let workbook: XLSX.WorkBook;
  try {
    // Les fichiers CSV sont décodés explicitement en UTF-8 : XLSX.read sur un
    // buffer CSV brut suppose sinon un encodage latin1 et corrompt les accents.
    workbook = isCsv
      ? XLSX.read(buffer.toString("utf-8").replace(/^﻿/, ""), {
          type: "string",
          cellDates: true,
        })
      : XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return NextResponse.json(
      { error: "Impossible de lire ce fichier (formats acceptés : .xlsx, .csv)" },
      { status: 400 }
    );
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    return NextResponse.json(
      { error: "Le fichier ne contient aucune feuille" },
      { status: 400 }
    );
  }

  const { headers, rows } = buildHeadersAndRows(sheet);

  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json(
      { error: "Le fichier ne contient aucune ligne de données" },
      { status: 400 }
    );
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Trop de lignes dans le fichier (maximum ${MAX_ROWS})` },
      { status: 400 }
    );
  }

  return NextResponse.json({ headers, rows });
}
