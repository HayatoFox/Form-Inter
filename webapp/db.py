"""Connexion SQLite de la webapp : une connexion par requête HTTP.

Réutilise scraper.db.connect() (source unique du schéma, PRAGMA WAL et
busy_timeout déjà appliqués) et ajoute le row_factory dict-like.
"""

import sqlite3

from scraper import db as scraper_db


def connexion() -> sqlite3.Connection:
    conn = scraper_db.connect()
    conn.row_factory = sqlite3.Row
    return conn
