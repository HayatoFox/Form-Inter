import { z } from "zod";

// Accepte les dates Excel réelles, les chaînes ISO, et le format français jj/mm/aaaa.
export function parseFlexibleDate(value: unknown): unknown {
  if (value === "" || value === undefined || value === null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const frMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (frMatch) {
      const [, d, mo, y] = frMatch;
      return new Date(Number(y), Number(mo) - 1, Number(d));
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return value;
}

// Accepte un nombre déjà propre, ou une chaîne comme "1,0 jours" / "2 jours"
// (virgule décimale française, unité collée à la valeur) en n'en gardant que
// la partie numérique de tête.
function extractLeadingNumber(value: unknown): unknown {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const match = normalized.match(/-?\d+(\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return value;
}

const optionalNumber = () =>
  z.preprocess(extractLeadingNumber, z.coerce.number().positive().optional());

const optionalDate = () =>
  z.preprocess(parseFlexibleDate, z.date().optional());

export const organismeSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis"),
  siteWeb: z.union([z.literal(""), z.string().trim().url()]).optional(),
  telephone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  notes: z.string().trim().optional(),
});

export const centreSchema = z.object({
  nom: z.string().trim().min(1, "Le nom du centre est requis"),
  ville: z.string().trim().min(1, "La ville est requise"),
  codePostal: z.string().trim().optional(),
  adresse: z.string().trim().optional(),
  organismeId: z.string().trim().min(1),
});

export const domaineSchema = z.object({
  nom: z.string().trim().min(1, "Le nom du domaine est requis"),
});

export const formationSchema = z.object({
  intitule: z.string().trim().min(1, "L'intitulé est requis"),
  description: z.string().trim().optional(),
  dureeValeur: optionalNumber(),
  dureeUnite: z.string().trim().optional(),
  organismeId: z.string().trim().min(1, "L'organisme est requis"),
  domaineId: z.string().trim().optional(),
});

export const sessionSchema = z.object({
  formationId: z.string().trim().min(1),
  centreId: z.string().trim().optional(),
  dateDebut: z.preprocess(parseFlexibleDate, z.date()),
  dateFin: optionalDate(),
  placesInfo: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

// Ligne "à plat" telle qu'obtenue après mapping d'une ligne de fichier importé.
export const importRowSchema = z.object({
  organisme: z.string().trim().min(1, "Organisme requis"),
  intitule: z.string().trim().min(1, "Intitulé requis"),
  domaine: z.string().trim().optional(),
  description: z.string().trim().optional(),
  dureeValeur: optionalNumber(),
  dureeUnite: z.string().trim().optional(),
  ville: z.string().trim().optional(),
  centre: z.string().trim().optional(),
  dateDebut: optionalDate(),
  dateFin: optionalDate(),
});

export type ImportRow = z.infer<typeof importRowSchema>;
