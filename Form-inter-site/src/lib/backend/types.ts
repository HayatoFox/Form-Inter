import { z } from "zod";

// Ligne telle que la publie le backend de veille : c'est le schéma à plat de
// la vue `sessions_effectives` (une ligne = une session d'un organisme), repris
// nom pour nom pour que la correspondance avec `scraper/db.py` reste évidente.
// Les deux connecteurs (API HTTP et lecture directe du fichier SQLite)
// produisent exactement cette forme.

const texte = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  });

const nombre = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

export const ligneBackendSchema = z.object({
  organisme: z.string().trim().min(1),
  formation: z.string().trim().min(1),
  type_formation: texte,
  domaine: texte,
  ville: texte,
  date_debut: texte,
  date_fin: texte,
  duree_jours: nombre,
  tarif: texte,
  remarque: texte,
  disponibilite: texte,
  url_programme: texte,
  source_url: texte,
  first_seen: texte,
  last_seen: texte,
});

export type LigneBackend = z.output<typeof ligneBackendSchema>;

export const reponseSessionsSchema = z.object({
  sessions: z.array(z.unknown()),
  page: z.number().int().optional(),
  pages: z.number().int().optional(),
  total: z.number().int().optional(),
});

export const reponseSanteSchema = z.object({
  service: z.string().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  sessions: z.number().int().optional(),
  organismes: z.number().int().optional(),
  dernier_scrape: z.union([z.string(), z.null()]).optional(),
  /** Un passage de collecte est en cours : le catalogue est incomplet. */
  scrape_en_cours: z.boolean().optional(),
});

export type Sante = z.output<typeof reponseSanteSchema>;

// Modes de liaison possibles :
// - "off"    : le site vit uniquement de ses imports Excel/CSV ;
// - "http"   : le backend expose son catalogue en JSON ;
// - "sqlite" : lecture directe du fichier data/formations.db du backend.
export type ModeBackend = "off" | "http" | "sqlite";

// Provenance d'une ligne du catalogue. SQLite n'ayant pas d'enum côté Prisma,
// ces deux constantes sont la référence partagée par tout le code.
export const MANUEL = "MANUEL";
export const BACKEND = "BACKEND";

export type ConfigBackend = {
  mode: ModeBackend;
  /** Base de l'API du backend, ex. http://localhost:8000 (mode "http"). */
  url: string;
  /** Chemin du fichier data/formations.db du backend (mode "sqlite"). */
  dbPath: string;
  /** Jeton Bearer de l'API du backend — ne sort jamais du serveur. */
  token: string;
  autoSync: boolean;
  ttlMinutes: number;
  /** Rapatrier aussi les sessions déjà passées (par défaut : non). */
  inclurePassees: boolean;
};

// Vue expédiable au navigateur : le jeton est remplacé par un simple booléen.
export type ConfigBackendPublique = Omit<ConfigBackend, "token"> & {
  tokenDefini: boolean;
};

export type CompteRendu = {
  lignesRecues: number;
  organismesCrees: number;
  centresCrees: number;
  domainesCrees: number;
  formationsCreees: number;
  sessionsCreees: number;
  sessionsMajs: number;
  sessionsRetirees: number;
};

export type ResultatSync = CompteRendu & {
  statut: "ok" | "erreur" | "ignore";
  message: string | null;
  mode: ModeBackend;
  dureeMs: number;
};

// Clé naturelle d'une session côté backend — la même que celle de l'upsert de
// `scraper/db.upsert_sessions`. Les id AUTOINCREMENT du backend ne sont pas
// repris : ils changent si la base est régénérée.
export function refSession(ligne: LigneBackend): string {
  return [
    ligne.organisme,
    ligne.formation,
    ligne.ville ?? "",
    ligne.date_debut ?? "",
    ligne.date_fin ?? "",
  ].join("|");
}

// Clé de rapprochement insensible à la casse et aux accents : elle évite de
// créer un doublon « Cepim » / « CEPIM » quand une donnée saisie à la main et
// une donnée du backend désignent la même chose.
export function cleNormalisee(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
