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
from concurrent.futures import ThreadPoolExecutor
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


def _collecter(module) -> dict:
    """Un organisme, dans son propre fil. Ne touche PAS à la base.

    Le fil ne fait que du réseau et du texte ; toute écriture SQLite reste dans
    le fil principal, sur l'unique connexion. C'est ce qui rend la
    parallélisation sûre sans rien changer à `db.py` : une connexion sqlite3
    n'est pas partageable entre fils, et on ne la partage pas.
    """
    demarre = datetime.now().isoformat(timespec="seconds")
    chrono = time.monotonic()
    try:
        sessions = assainir(module.scrape())
        return {"module": module, "demarre": demarre, "sessions": sessions,
                "duree": time.monotonic() - chrono, "erreur": None}
    except Exception:
        return {"module": module, "demarre": demarre, "sessions": None,
                "duree": time.monotonic() - chrono,
                "erreur": traceback.format_exc()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--declencheur", choices=["cron", "manuel"], default="cron")
    args = parser.parse_args()

    conn = db.connect()
    erreurs = 0
    print(f"--- Scrape du {datetime.now():%Y-%m-%d %H:%M} ({args.declencheur}) ---")

    # Les cinq organismes sont collectés DE FRONT, et non l'un après l'autre.
    #
    # L'essentiel du temps d'un passage n'est pas du calcul : c'est l'attente —
    # la latence des sites, et surtout le délai de politesse que chaque scraper
    # respecte entre deux pages (0,5 à 1 s, sur deux à trois cents pages pour
    # les plus gros). Ces attentes s'additionnaient alors qu'elles visent CINQ
    # SITES DIFFÉRENTS. Le passage dure maintenant à peu près le temps du plus
    # lent, au lieu de la somme.
    #
    # Aucun site n'est sollicité plus durement qu'avant : chaque scraper garde
    # son propre délai entre ses propres pages, et un seul fil s'occupe de lui.
    with ThreadPoolExecutor(max_workers=len(SCRAPERS)) as pool:
        rendus = list(pool.map(_collecter, SCRAPERS))

    # Les écritures, elles, restent sérielles et dans le fil principal.
    for rendu in rendus:
        nom = rendu["module"].ORGANISME
        if rendu["erreur"] is None:
            sessions = rendu["sessions"]
            db.upsert_sessions(conn, sessions)
            villes = len({s["ville"] for s in sessions})
            print(f"[OK] {nom} : {len(sessions)} sessions ({villes} villes)")
            statut, nb, message = "ok", len(sessions), None
        else:
            erreurs += 1
            print(f"[ERREUR] {nom} :\n{rendu['erreur']}", file=sys.stderr)
            statut, nb, message = "erreur", None, rendu["erreur"][-2000:]
        with conn:
            conn.execute(
                """INSERT INTO scrape_runs (organisme, demarre_le, duree_s,
                                            nb_sessions, statut, message, declencheur)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (nom, rendu["demarre"], round(rendu["duree"], 1),
                 nb, statut, message, args.declencheur))

    total = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
    print(f"Total en base : {total} sessions -> {db.DB_PATH}")
    conn.close()
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
