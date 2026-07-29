import { z } from "zod";
import { dateCalendaire, normaliserDate, parseDateISO } from "@/lib/dates";

// Accepte les dates Excel réelles, les chaînes ISO, et le format français
// jj/mm/aaaa. Le résultat est toujours ramené à minuit UTC : les dates du site
// sont des dates calendaires, et le backend ne transmet que des AAAA-MM-JJ.
export function parseFlexibleDate(value: unknown): unknown {
  if (value === "" || value === undefined || value === null) return undefined;
  if (value instanceof Date) return normaliserDate(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    const frMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (frMatch) {
      const [, d, mo, y] = frMatch;
      return dateCalendaire(Number(y), Number(mo), Number(d));
    }
    const iso = parseDateISO(trimmed);
    if (iso) return iso;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return normaliserDate(parsed);
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

// Une session sans date de début est une offre à entrée/sortie permanente
// (cas remonté par le backend) : la date n'est exigée que si la case
// « permanente » n'est pas cochée.
export const sessionSchema = z
  .object({
    formationId: z.string().trim().min(1),
    centreId: z.string().trim().optional(),
    dateDebut: optionalDate(),
    dateFin: optionalDate(),
    permanente: z.coerce.boolean().default(false),
    placesInfo: z.string().trim().optional(),
    tarif: z.string().trim().optional(),
    remarque: z.string().trim().optional(),
  })
  .refine((s) => s.permanente || s.dateDebut !== undefined, {
    message: "La date de début est requise (ou cochez « entrée permanente »)",
    path: ["dateDebut"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

// Ligne "à plat" telle qu'obtenue après mapping d'une ligne de fichier importé.
// Les champs ajoutés après coup (type, tarif, places, remarque, lien programme)
// alignent l'import manuel sur ce que remonte le backend : un fichier fourni
// par un organisme et une session scrapée décrivent la même chose.
export const importRowSchema = z.object({
  organisme: z.string().trim().min(1, "Organisme requis"),
  intitule: z.string().trim().min(1, "Intitulé requis"),
  domaine: z.string().trim().optional(),
  typeFormation: z.string().trim().optional(),
  description: z.string().trim().optional(),
  dureeValeur: optionalNumber(),
  dureeUnite: z.string().trim().optional(),
  ville: z.string().trim().optional(),
  centre: z.string().trim().optional(),
  dateDebut: optionalDate(),
  dateFin: optionalDate(),
  tarif: z.string().trim().optional(),
  placesInfo: z.string().trim().optional(),
  remarque: z.string().trim().optional(),
  urlProgramme: z.string().trim().optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;
