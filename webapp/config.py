"""Configuration de la webapp : port, secret de signature, seuils d'alerte."""

import os
import secrets

from scraper.db import DB_PATH

PORT = int(os.environ.get("WEBAPP_PORT", "8000"))
DATA_DIR = DB_PATH.parent
LOGS_DIR = DB_PATH.parent.parent / "logs"

PAR_PAGE = 50
DUREE_SESSION_S = 7 * 24 * 3600     # validité du cookie de connexion

# Santé des scrapers
SEUIL_CHUTE = 0.5      # alerte si nb sessions < 50 % du dernier passage ok
SEUIL_CRON_H = 26      # alerte si aucun passage depuis plus de 26 h

# Premier compte admin, créé au démarrage si la table utilisateurs est vide
ADMIN_INITIAL_USER = os.environ.get("WEBAPP_ADMIN_USER", "admin")
ADMIN_INITIAL_PASSWORD = os.environ.get("WEBAPP_ADMIN_PASSWORD")  # None = généré


def _charger_secret() -> bytes:
    """Clé de signature des cookies : env WEBAPP_SECRET, sinon générée une
    fois et persistée dans data/.secret (les sessions survivent aux
    redémarrages)."""
    env = os.environ.get("WEBAPP_SECRET")
    if env:
        return env.encode()
    fichier = DATA_DIR / ".secret"
    if fichier.exists():
        return fichier.read_bytes().strip()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_hex(32).encode()
    fichier.write_bytes(secret)
    fichier.chmod(0o600)
    return secret


SECRET = _charger_secret()
