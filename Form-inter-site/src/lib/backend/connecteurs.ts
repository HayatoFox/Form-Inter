import "server-only";
import path from "node:path";
import Database from "better-sqlite3";
import type { ConfigBackend } from "@/lib/backend/config";
import {
  ligneBackendSchema,
  reponseSanteSchema,
  reponseSessionsSchema,
  type LigneBackend,
  type Sante,
} from "@/lib/backend/types";
import { versInputDate, debutDuJour } from "@/lib/dates";

// Deux façons de brancher le site sur la base du backend de veille :
//
// - "http"   : le backend expose son catalogue en JSON (webapp/api.py). C'est
//              le mode à privilégier dès que les deux ne tournent pas sur la
//              même machine, et le seul qui traverse un réseau.
// - "sqlite" : lecture directe du fichier data/formations.db, quand le site et
//              le backend partagent le même volume (docker compose, même hôte).
//              Aucune écriture n'est faite : le scraper reste seul écrivain.
//
// Les deux renvoient exactement la même forme de lignes, si bien que le moteur
// de synchronisation ignore lequel a servi.

export class ErreurBackend extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurBackend";
  }
}

export type Connecteur = {
  mode: "http" | "sqlite";
  /** Vérifie que la liaison répond, sans rapatrier le catalogue. */
  tester(): Promise<Sante>;
  lireSessions(): Promise<LigneBackend[]>;
};

const DELAI_MS = 30_000;
const PAR_PAGE = 1000;
const PAGES_MAX = 500;

function valider(lignes: unknown[], origine: string): LigneBackend[] {
  const valides: LigneBackend[] = [];
  let rejetees = 0;
  for (const brute of lignes) {
    const parsee = ligneBackendSchema.safeParse(brute);
    if (parsee.success) valides.push(parsee.data);
    else rejetees += 1;
  }
  if (valides.length === 0 && rejetees > 0) {
    throw new ErreurBackend(
      `${origine} : aucune des ${rejetees} lignes reçues n'a le format attendu`
    );
  }
  return valides;
}

// --- Connecteur HTTP ---------------------------------------------------------

function creerConnecteurHttp(config: ConfigBackend): Connecteur {
  if (!config.url) {
    throw new ErreurBackend("Adresse de l'API du backend non renseignée");
  }

  const base = config.url;
  const entetes: Record<string, string> = { Accept: "application/json" };
  if (config.token) entetes.Authorization = `Bearer ${config.token}`;

  async function appeler(chemin: string): Promise<unknown> {
    let reponse: Response;
    try {
      reponse = await fetch(`${base}${chemin}`, {
        headers: entetes,
        cache: "no-store",
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch (err) {
      const cause = err instanceof Error ? err.message : "erreur inconnue";
      throw new ErreurBackend(`Backend injoignable sur ${base} (${cause})`);
    }

    if (reponse.status === 401 || reponse.status === 403) {
      throw new ErreurBackend(
        "Jeton refusé par le backend (vérifiez WEBAPP_API_TOKEN côté backend)"
      );
    }
    if (reponse.status === 404) {
      throw new ErreurBackend(
        `${base}${chemin} introuvable — le backend expose-t-il bien son API JSON ?`
      );
    }
    if (!reponse.ok) {
      throw new ErreurBackend(
        `Le backend a répondu ${reponse.status} sur ${chemin}`
      );
    }

    try {
      return await reponse.json();
    } catch {
      throw new ErreurBackend(
        `Réponse illisible du backend sur ${chemin} (JSON attendu)`
      );
    }
  }

  return {
    mode: "http",

    async tester() {
      const brut = await appeler("/api/sante");
      const parsee = reponseSanteSchema.safeParse(brut);
      if (!parsee.success) {
        throw new ErreurBackend("Réponse inattendue de /api/sante");
      }
      return parsee.data;
    },

    async lireSessions() {
      const lignes: LigneBackend[] = [];
      let page = 1;
      let pages = 1;

      do {
        const params = new URLSearchParams({
          page: String(page),
          par_page: String(PAR_PAGE),
        });
        if (config.inclurePassees) params.set("passees", "1");

        const brut = await appeler(`/api/sessions?${params}`);
        const parsee = reponseSessionsSchema.safeParse(brut);
        if (!parsee.success) {
          throw new ErreurBackend("Réponse inattendue de /api/sessions");
        }
        lignes.push(...valider(parsee.data.sessions, "/api/sessions"));
        pages = parsee.data.pages ?? 1;
        page += 1;
      } while (page <= pages && page <= PAGES_MAX);

      // La synchronisation traite le lot reçu comme le catalogue complet et
      // retire ce qui n'y figure pas : un lot tronqué doit échouer bruyamment
      // plutôt que d'amputer le site.
      if (page <= pages) {
        throw new ErreurBackend(
          `Le backend annonce ${pages} pages, au-delà de la limite de ${PAGES_MAX} : ` +
            "lot incomplet, synchronisation interrompue."
        );
      }

      return lignes;
    },
  };
}

// --- Connecteur SQLite -------------------------------------------------------

const COLONNES = `organisme, formation, type_formation, domaine, ville,
    date_debut, date_fin, duree_jours, tarif, remarque, disponibilite,
    url_programme, source_url, first_seen, last_seen`;

// « Offre courante » : le dernier passage du scraper, corrélé PAR organisme —
// un scraper en échec un matin ne doit pas faire disparaître son organisme.
const OFFRE_COURANTE = `last_seen = (SELECT MAX(s2.last_seen) FROM sessions s2
                                     WHERE s2.organisme = base.organisme)`;

function creerConnecteurSqlite(config: ConfigBackend): Connecteur {
  // Chemin choisi par l'admin, résolu à l'exécution : il désigne un fichier
  // hors du projet (le volume partagé avec le backend), rien à embarquer dans
  // le bundle — d'où l'exclusion du traçage de fichiers.
  const chemin = path.resolve(/* turbopackIgnore: true */ process.cwd(), config.dbPath);

  function ouvrir(): Database.Database {
    try {
      // Lecture seule d'abord. Une base en WAL peut refuser ce mode quand le
      // fichier -shm n'existe pas encore : on retombe alors sur une ouverture
      // classique verrouillée en lecture par PRAGMA query_only.
      return new Database(chemin, { readonly: true, fileMustExist: true });
    } catch (err) {
      if (err instanceof Error && /unable to open|readonly/i.test(err.message)) {
        const db = new Database(chemin, { fileMustExist: true });
        db.pragma("query_only = ON");
        return db;
      }
      throw new ErreurBackend(
        `Base du backend illisible (${chemin}) : ${
          err instanceof Error ? err.message : "erreur inconnue"
        }`
      );
    }
  }

  // La vue `sessions_effectives` applique les corrections durables du back
  // office du backend (masquage, renommage, reclassement). Elle est recréée à
  // chaque connexion du backend ; si elle manque (base neuve jamais ouverte par
  // le scraper), on se rabat sur la table brute.
  function sourceDisponible(db: Database.Database): "vue" | "table" {
    const noms = db
      .prepare("SELECT name FROM sqlite_master WHERE name IN (?, ?)")
      .all("sessions_effectives", "sessions")
      .map((r) => (r as { name: string }).name);
    if (noms.includes("sessions_effectives")) return "vue";
    if (noms.includes("sessions")) return "table";
    throw new ErreurBackend(
      `${chemin} ne contient pas de table \`sessions\` — est-ce bien la base du backend ?`
    );
  }

  function requete(source: "vue" | "table"): { sql: string; params: string[] } {
    const table = source === "vue" ? "sessions_effectives" : "sessions";
    const conditions = [source === "vue" ? "masquee = 0" : "1=1", OFFRE_COURANTE];
    const params: string[] = [];

    if (!config.inclurePassees) {
      conditions.push(
        "(date_debut IS NULL OR COALESCE(date_fin, date_debut) >= ?)"
      );
      params.push(versInputDate(debutDuJour()));
    }

    return {
      sql: `SELECT ${COLONNES} FROM ${table} AS base WHERE ${conditions.join(
        " AND "
      )}`,
      params,
    };
  }

  return {
    mode: "sqlite",

    async tester() {
      const db = ouvrir();
      try {
        const source = sourceDisponible(db);
        const stats = db
          .prepare(
            `SELECT COUNT(*) AS sessions,
                    COUNT(DISTINCT organisme) AS organismes,
                    MAX(last_seen) AS dernier_scrape
             FROM sessions`
          )
          .get() as {
          sessions: number;
          organismes: number;
          dernier_scrape: string | null;
        };
        return {
          service: `SQLite ${chemin} (${source === "vue" ? "vue sessions_effectives" : "table sessions"})`,
          sessions: stats.sessions,
          organismes: stats.organismes,
          dernier_scrape: stats.dernier_scrape,
        };
      } finally {
        db.close();
      }
    },

    async lireSessions() {
      const db = ouvrir();
      try {
        const { sql, params } = requete(sourceDisponible(db));
        return valider(db.prepare(sql).all(...params), chemin);
      } finally {
        db.close();
      }
    },
  };
}

export function creerConnecteur(config: ConfigBackend): Connecteur {
  if (config.mode === "http") return creerConnecteurHttp(config);
  if (config.mode === "sqlite") return creerConnecteurSqlite(config);
  throw new ErreurBackend(
    "Liaison backend désactivée — choisissez un mode dans Admin › Sources de données"
  );
}
