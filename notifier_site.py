#!/usr/bin/env python3
"""Prévient le site de consultation qu'il y a du neuf à rapatrier.

Appelé par ``run_scraper.sh`` à la fin de chaque passage de collecte. C'est
l'enchaînement qui manquait : le scraper écrivait sa base, et le site
n'apprenait la nouvelle qu'à la visite d'un être humain, ou en forçant la
synchronisation depuis le back office. Une collecte de nuit ne servait donc à
rien tant que personne n'ouvrait la page.

Le déclenchement est ici plutôt que dans un ordonnanceur à part, pour une
raison : c'est la fin de la collecte qui est le vrai signal. Une tâche
planifiée indépendante devrait deviner combien de temps dure un passage — dix
à quinze minutes, mais cela dépend des sites scrapés — et se tromperait les
jours où il déborde.

Stdlib seulement, comme tout le backend : pas de curl dans l'image, pas de
dépendance à installer.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime

DELAI_DEFAUT = 900  # 15 min : la synchronisation écrit plusieurs milliers de lignes.


def horodatage() -> str:
    return datetime.now().strftime("%F %T")


def journaliser(message: str) -> None:
    print(f"{horodatage()} : {message}", flush=True)


def main() -> int:
    url = os.environ.get("SITE_SYNC_URL", "").strip()
    jeton = os.environ.get("CRON_SECRET", "").strip()

    # Absence de configuration = fonctionnalité non demandée, pas une erreur :
    # le scraper doit rester utilisable seul, sans site en face.
    if not url:
        return 0
    if not jeton:
        journaliser(
            "Site : CRON_SECRET absent, notification ignorée "
            "(l'endpoint du site refuserait l'appel)."
        )
        return 0

    delai = int(os.environ.get("SITE_SYNC_TIMEOUT", DELAI_DEFAUT))
    requete = urllib.request.Request(
        url,
        method="POST",
        headers={
            "Authorization": f"Bearer {jeton}",
            "Accept": "application/json",
        },
    )

    journaliser(f"Site : synchronisation demandée à {url}")
    try:
        with urllib.request.urlopen(requete, timeout=delai) as reponse:
            corps = reponse.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as erreur:
        detail = erreur.read().decode("utf-8", "replace")[:400]
        journaliser(f"Site : refus HTTP {erreur.code} — {detail}")
        return 1
    except (urllib.error.URLError, OSError, TimeoutError) as erreur:
        # Site éteint, en cours de redémarrage, réseau du compose pas encore
        # prêt : la collecte, elle, a bien eu lieu. On le dit et on s'arrête là.
        journaliser(f"Site : injoignable ({erreur}). La base du backend est à jour.")
        return 1

    try:
        resultat = json.loads(corps)
    except json.JSONDecodeError:
        journaliser(f"Site : réponse inattendue — {corps[:400]}")
        return 1

    statut = resultat.get("statut", "?")
    if statut == "erreur":
        journaliser(f"Site : synchronisation en erreur — {resultat.get('message', '')}")
        return 1
    if statut == "ignore":
        journaliser("Site : synchronisation reportée (un passage était déjà en cours).")
        return 0

    journaliser(
        "Site : synchronisé — "
        f"{resultat.get('lignesRecues', 0)} ligne(s) reçue(s), "
        f"{resultat.get('sessionsCreees', 0)} session(s) ajoutée(s), "
        f"{resultat.get('sessionsMajs', 0)} mise(s) à jour, "
        f"{resultat.get('sessionsRetirees', 0)} retirée(s)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
