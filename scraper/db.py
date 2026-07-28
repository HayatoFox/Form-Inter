"""Accès SQLite : schéma et insertion/mise à jour des sessions de formation."""

import sqlite3
from datetime import date
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "formations.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    organisme      TEXT NOT NULL,
    formation      TEXT NOT NULL,
    type_formation TEXT,
    ville          TEXT,
    date_debut     TEXT,             -- ISO YYYY-MM-DD ; NULL = entrée permanente
    date_fin       TEXT,             -- ISO YYYY-MM-DD ; NULL = sortie permanente
    duree_jours    REAL,
    domaine        TEXT,             -- classification commune (scraper/domaines.py)
    tarif          TEXT,
    remarque       TEXT,             -- ex. « Session ouverte toutes les semaines »
    disponibilite  TEXT,             -- ex. « Places disponibles », « Complet »
    url_programme  TEXT,
    source_url     TEXT,
    first_seen     TEXT NOT NULL,    -- date du premier scrape où la session est apparue
    last_seen      TEXT NOT NULL     -- date du dernier scrape où elle était encore affichée
);
CREATE INDEX IF NOT EXISTS idx_sessions_date_debut ON sessions (date_debut);
CREATE INDEX IF NOT EXISTS idx_sessions_ville ON sessions (ville);
CREATE INDEX IF NOT EXISTS idx_sessions_domaine ON sessions (domaine);
-- Toutes les lectures du site filtrent sur « l'offre courante », c'est-à-dire
-- last_seen = MAX(last_seen) de l'organisme. Sans cet index, ce MAX corrélé
-- rebalayait la table pour chaque ligne examinée (~2 s par requête).
CREATE INDEX IF NOT EXISTS idx_sessions_organisme_last_seen
    ON sessions (organisme, last_seen);

CREATE TABLE IF NOT EXISTS utilisateurs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    identifiant   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    mdp_hash      TEXT NOT NULL,          -- scrypt$<salt_hex>$<hash_hex>
    admin         INTEGER NOT NULL DEFAULT 0,
    actif         INTEGER NOT NULL DEFAULT 1,
    cree_le       TEXT NOT NULL,
    dernier_acces TEXT
);

-- Corrections admin durables : appliquées par LEFT JOIN dans la vue
-- sessions_effectives, jamais en modifiant sessions (que les scrapes
-- écrasent). Clé naturelle alignée sur l'upsert ; '' remplace NULL pour
-- que la contrainte UNIQUE soit fiable (deux NULL sont distincts en SQL).
CREATE TABLE IF NOT EXISTS overrides (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    organisme          TEXT NOT NULL,
    formation          TEXT NOT NULL,      -- libellé original scrapé
    ville              TEXT NOT NULL DEFAULT '',
    date_debut         TEXT NOT NULL DEFAULT '',
    date_fin           TEXT NOT NULL DEFAULT '',
    masquee            INTEGER NOT NULL DEFAULT 0,
    domaine_override   TEXT,
    formation_override TEXT,
    note_interne       TEXT,
    maj_le             TEXT NOT NULL,
    UNIQUE (organisme, formation, ville, date_debut, date_fin)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    organisme   TEXT NOT NULL,
    demarre_le  TEXT NOT NULL,             -- ISO datetime
    duree_s     REAL,
    nb_sessions INTEGER,
    statut      TEXT NOT NULL,             -- 'ok' | 'erreur'
    message     TEXT,
    declencheur TEXT NOT NULL DEFAULT 'cron'
);
CREATE INDEX IF NOT EXISTS idx_runs_org ON scrape_runs (organisme, demarre_le);

-- Combinaisons de filtres mémorisées par un utilisateur (« CACES Grand Ouest »,
-- « Habilitations à 30 jours »…). `filtres` est le JSON des filtres validés :
-- il est reparsé par filtres.parser() à l'application, jamais injecté en SQL.
-- partagee = 1 : la vue est proposée à toute l'équipe.
CREATE TABLE IF NOT EXISTS vues (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    nom            TEXT NOT NULL,
    filtres        TEXT NOT NULL,
    partagee       INTEGER NOT NULL DEFAULT 0,
    cree_le        TEXT NOT NULL,
    UNIQUE (utilisateur_id, nom)
);
CREATE INDEX IF NOT EXISTS idx_vues_utilisateur ON vues (utilisateur_id);
"""

# Vue de lecture appliquant les corrections admin. Sa définition peut évoluer
# d'une version à l'autre : `_synchroniser_vues()` la recrée quand elle a
# changé, et seulement dans ce cas (cf. la note sur la concurrence).
VUE_SESSIONS_EFFECTIVES = """CREATE VIEW sessions_effectives AS
SELECT s.id, s.organisme,
       COALESCE(o.formation_override, s.formation) AS formation,
       s.formation                                 AS formation_origine,
       s.type_formation,
       COALESCE(o.domaine_override, s.domaine)     AS domaine,
       s.ville, s.date_debut, s.date_fin, s.duree_jours, s.tarif,
       s.remarque, s.disponibilite, s.url_programme, s.source_url,
       s.first_seen, s.last_seen,
       COALESCE(o.masquee, 0)                      AS masquee,
       o.note_interne,
       (o.id IS NOT NULL)                          AS a_override
FROM sessions s
LEFT JOIN overrides o
  ON  o.organisme  = s.organisme
  AND o.formation  = s.formation
  AND o.ville      = COALESCE(s.ville, '')
  AND o.date_debut = COALESCE(s.date_debut, '')
  AND o.date_fin   = COALESCE(s.date_fin, '')"""

_VUES = {"sessions_effectives": VUE_SESSIONS_EFFECTIVES}


def _normaliser(sql: str) -> str:
    """Compare deux définitions SQL en ignorant l'indentation."""
    return " ".join(sql.split())


def _synchroniser_vues(conn: sqlite3.Connection) -> None:
    """Recrée les vues dont la définition a changé — et uniquement celles-là.

    Les recréer systématiquement (DROP + CREATE à chaque connexion) posait
    deux problèmes : la webapp ouvre une connexion par requête HTTP et le
    navigateur en lance plusieurs de front, ce qui faisait courir deux threads
    entre le DROP et le CREATE (« view already exists ») ; et cela prenait un
    verrou d'écriture à chaque page, en concurrence avec les ~10 minutes
    d'écriture du scraper. On ne touche donc à la base que si la définition
    stockée diffère réellement de celle du code — c'est-à-dire après une mise
    à jour du schéma, pas en fonctionnement normal.
    """
    for nom, definition in _VUES.items():
        existante = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = ?",
            (nom,)).fetchone()
        if existante and _normaliser(existante[0]) == _normaliser(definition):
            continue
        try:
            # BEGIN IMMEDIATE : le DROP et le CREATE sont atomiques vis-à-vis
            # des autres connexions, qui attendent (busy_timeout) puis
            # constatent que la vue est déjà à jour.
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(f"DROP VIEW IF EXISTS {nom}")
            conn.execute(definition)
            conn.commit()
        except sqlite3.OperationalError:
            # Base verrouillée par un scrape en cours, ou vue déjà recréée à
            # l'identique par une connexion concurrente : sans gravité, la
            # prochaine connexion réessaiera.
            conn.rollback()

# Colonnes ajoutées après la première version du schéma : ajoutées à la volée
# sur les bases existantes (ALTER TABLE), pour ne pas avoir à les recréer.
_MIGRATIONS = {
    "remarque": "ALTER TABLE sessions ADD COLUMN remarque TEXT",
    "disponibilite": "ALTER TABLE sessions ADD COLUMN disponibilite TEXT",
    "domaine": "ALTER TABLE sessions ADD COLUMN domaine TEXT",
}


def connect(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=15)
    # WAL : le scraper (écritures ~10 min) et la webapp (lectures) cohabitent
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=15000")
    conn.executescript(SCHEMA)
    colonnes = {r[1] for r in conn.execute("PRAGMA table_info(sessions)")}
    for colonne, alter in _MIGRATIONS.items():
        if colonne not in colonnes:
            conn.execute(alter)
    conn.commit()
    _synchroniser_vues(conn)
    return conn


_CHAMPS = ["organisme", "formation", "type_formation", "domaine", "ville",
           "date_debut", "date_fin", "duree_jours", "tarif", "remarque",
           "disponibilite", "url_programme", "source_url"]


def upsert_sessions(conn: sqlite3.Connection, rows: list[dict]) -> int:
    """Insère les sessions ; si déjà connues (même organisme/formation/ville/dates,
    comparaison sûre avec NULL), rafraîchit last_seen et les champs susceptibles
    de changer. Retourne le nombre de lignes traitées."""
    today = date.today().isoformat()
    with conn:
        for r in rows:
            r = {c: r.get(c) for c in _CHAMPS}
            existant = conn.execute(
                """SELECT id FROM sessions
                   WHERE organisme = :organisme AND formation IS :formation
                     AND ville IS :ville AND date_debut IS :date_debut
                     AND date_fin IS :date_fin""", r).fetchone()
            if existant:
                conn.execute(
                    """UPDATE sessions SET last_seen = :today,
                           type_formation = :type_formation, domaine = :domaine,
                           duree_jours = :duree_jours,
                           tarif = :tarif, remarque = :remarque,
                           disponibilite = :disponibilite,
                           url_programme = :url_programme, source_url = :source_url
                       WHERE id = :id""", {**r, "today": today, "id": existant[0]})
            else:
                conn.execute(
                    f"""INSERT INTO sessions ({', '.join(_CHAMPS)}, first_seen, last_seen)
                        VALUES ({', '.join(':' + c for c in _CHAMPS)}, :today, :today)""",
                    {**r, "today": today})
    return len(rows)
