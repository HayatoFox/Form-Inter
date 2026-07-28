"""Déclenchement manuel d'un scrape depuis le back office.

Verrou fcntl sur data/.scrape.lock : partagé avec le cron (run_scraper.sh
utilise `flock -n` sur le même fichier), se libère automatiquement à la
mort du processus détenteur — pas de verrou orphelin possible.
"""

import fcntl
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

from . import config

FICHIER_VERROU = config.DATA_DIR / ".scrape.lock"
RACINE_PROJET = Path(__file__).resolve().parent.parent

# Heure de début du scrape lancé par CE processus (None si aucun) : évite de
# re-sonder flock depuis le processus qui détient déjà le verrou.
_debut_local: str | None = None


def scrape_en_cours() -> str | None:
    """None si aucun scrape en cours, sinon l'heure de début."""
    if _debut_local:
        return _debut_local
    if not FICHIER_VERROU.exists():
        return None
    # Sonde pour un détenteur externe (cron). Mode "a" : ne tronque pas le
    # fichier, ne modifie pas son mtime (= heure de début affichée).
    with open(FICHIER_VERROU, "a") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fcntl.flock(f, fcntl.LOCK_UN)
            return None
        except BlockingIOError:
            mtime = datetime.fromtimestamp(FICHIER_VERROU.stat().st_mtime)
            return mtime.strftime("%H:%M")


def demarrer_scrape() -> bool:
    """Lance le scrape en arrière-plan. False si un scrape est déjà en cours."""
    global _debut_local
    if _debut_local:
        return False
    FICHIER_VERROU.parent.mkdir(parents=True, exist_ok=True)
    verrou = open(FICHIER_VERROU, "w")
    try:
        fcntl.flock(verrou, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        verrou.close()
        return False
    FICHIER_VERROU.touch()  # mtime = heure de début affichée dans l'admin
    _debut_local = datetime.now().strftime("%H:%M")

    def _executer():
        global _debut_local
        try:
            config.LOGS_DIR.mkdir(parents=True, exist_ok=True)
            nom_log = config.LOGS_DIR / f"scrape_manuel_{datetime.now():%Y-%m}.log"
            with open(nom_log, "a") as journal:
                journal.write(f"\n--- Scrape manuel du {datetime.now():%Y-%m-%d %H:%M} ---\n")
                journal.flush()
                subprocess.run(
                    [sys.executable, "-m", "scraper.main", "--declencheur=manuel"],
                    cwd=RACINE_PROJET, stdout=journal, stderr=subprocess.STDOUT,
                    timeout=3600)
        finally:
            _debut_local = None
            fcntl.flock(verrou, fcntl.LOCK_UN)
            verrou.close()

    threading.Thread(target=_executer, daemon=True, name="scrape-manuel").start()
    return True
