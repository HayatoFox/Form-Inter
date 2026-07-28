"""Lance tous les scrapers enregistrés et alimente la BDD SQLite.

Usage : python3 -m scraper.main [--declencheur=cron|manuel]
Pour ajouter un organisme : créer scraper/sites/<nom>.py exposant
ORGANISME (str) et scrape() -> list[dict], puis l'ajouter à SCRAPERS.
Chaque passage est historisé dans la table scrape_runs (santé des scrapers,
consultée par le back office de la webapp).
"""

import argparse
import sys
import time
import traceback
from datetime import datetime

from . import db, domaines
from .sites import acn, cepim, pilocap, temis, voltwork

SCRAPERS = [temis, pilocap, cepim, acn, voltwork]


def assainir(sessions: list[dict]) -> list[dict]:
    """Post-traitement commun : classification en domaine + garde-fous.
    Une date de fin antérieure au début (coquille du site source) est ramenée
    à une session d'un jour, l'affichage d'origine étant consigné en remarque."""
    for s in sessions:
        s["domaine"] = domaines.classer(s.get("formation"), s.get("type_formation"))
        debut, fin = s.get("date_debut"), s.get("date_fin")
        if debut and fin and fin < debut:
            note = f"date de fin affichée sur le site : {fin} (incohérente)"
            s["remarque"] = f"{s['remarque']} ; {note}" if s.get("remarque") else note
            s["date_fin"] = debut
            s["duree_jours"] = 1
    return sessions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--declencheur", choices=["cron", "manuel"], default="cron")
    args = parser.parse_args()

    conn = db.connect()
    erreurs = 0
    print(f"--- Scrape du {datetime.now():%Y-%m-%d %H:%M} ({args.declencheur}) ---")
    for module in SCRAPERS:
        nom = module.ORGANISME
        demarre = datetime.now().isoformat(timespec="seconds")
        chrono = time.monotonic()
        try:
            sessions = assainir(module.scrape())
            db.upsert_sessions(conn, sessions)
            villes = len({s["ville"] for s in sessions})
            print(f"[OK] {nom} : {len(sessions)} sessions ({villes} villes)")
            statut, nb, message = "ok", len(sessions), None
        except Exception:
            erreurs += 1
            print(f"[ERREUR] {nom} :", file=sys.stderr)
            traceback.print_exc()
            statut, nb, message = "erreur", None, traceback.format_exc()[-2000:]
        with conn:
            conn.execute(
                """INSERT INTO scrape_runs (organisme, demarre_le, duree_s,
                                            nb_sessions, statut, message, declencheur)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (nom, demarre, round(time.monotonic() - chrono, 1),
                 nb, statut, message, args.declencheur))
    total = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    print(f"Total en base : {total} sessions -> {db.DB_PATH}")
    conn.close()
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
