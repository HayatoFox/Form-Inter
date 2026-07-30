export const IMPORT_TARGET_FIELDS = [
  { value: "organisme", label: "Organisme (nom)" },
  { value: "intitule", label: "Intitulé de la formation" },
  { value: "domaine", label: "Domaine" },
  { value: "typeFormation", label: "Type / catégorie d'origine" },
  { value: "description", label: "Description" },
  { value: "dureeValeur", label: "Durée (valeur)" },
  { value: "dureeUnite", label: "Durée (unité)" },
  { value: "ville", label: "Ville" },
  { value: "centre", label: "Nom du centre" },
  { value: "dateDebut", label: "Date de début" },
  { value: "dateFin", label: "Date de fin" },
  { value: "tarif", label: "Tarif" },
  { value: "placesInfo", label: "Disponibilité / places" },
  { value: "remarque", label: "Remarque" },
  { value: "urlProgramme", label: "Lien vers le programme" },
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number]["value"];

const GUESS_KEYWORDS: Record<ImportTargetField, string[]> = {
  organisme: ["organisme", "organisation", "partenaire"],
  intitule: ["intitule", "formation", "titre", "nom de la formation"],
  domaine: ["domaine", "theme"],
  typeFormation: ["type", "categorie", "famille"],
  description: ["description", "descriptif", "resume"],
  dureeValeur: ["duree", "duration"],
  dureeUnite: ["unite"],
  ville: ["ville", "lieu", "city"],
  centre: ["centre", "site"],
  dateDebut: ["date debut", "date de debut", "debut", "date"],
  dateFin: ["date fin", "date de fin", "fin"],
  tarif: ["tarif", "prix", "cout", "montant"],
  placesInfo: ["disponibilite", "places", "dispo"],
  remarque: ["remarque", "commentaire", "note", "observation"],
  urlProgramme: ["programme", "lien", "url", "fiche"],
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function guessMapping(
  headers: string[]
): Record<string, ImportTargetField | ""> {
  const mapping: Record<string, ImportTargetField | ""> = {};
  const usedFields = new Set<ImportTargetField>();

  for (const header of headers) {
    const normalized = normalize(header);
    let matched: ImportTargetField | "" = "";

    for (const field of IMPORT_TARGET_FIELDS) {
      if (usedFields.has(field.value)) continue;
      const keywords = GUESS_KEYWORDS[field.value];
      if (keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
        matched = field.value;
        break;
      }
    }

    if (matched) usedFields.add(matched);
    mapping[header] = matched;
  }

  return mapping;
}

export function applyMapping(
  row: Record<string, unknown>,
  mapping: Record<string, ImportTargetField | "">
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (!target) continue;
    mapped[target] = row[header];
  }
  return mapped;
}
