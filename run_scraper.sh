#!/usr/bin/env bash
# Point d'entrée cron : lance le scrape et journalise dans logs/.
# Verrou partagé avec le scrape manuel du back office (data/.scrape.lock) :
# si l'un tourne, l'autre s'efface proprement.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p logs data
JOURNAL="logs/scrape_$(date +%Y-%m).log"

# Lancé par cron, ce script démarre avec un environnement quasi vide : les
# variables du conteneur (dont l'adresse du site et son jeton) sont reportées
# ici par l'entrypoint. Absent hors Docker, ce fichier n'est simplement pas là.
if [ -f .env-cron ]; then
    set -a
    # shellcheck disable=SC1091
    source .env-cron
    set +a
fi

exec 9>data/.scrape.lock
if ! flock -n 9; then
    echo "$(date '+%F %T') : scrape déjà en cours (verrou pris), passage ignoré." | tee -a "$JOURNAL"
    exit 0
fi

if [ -d .venv ]; then
    source .venv/bin/activate
fi
# Sortie journalisée dans logs/ et renvoyée sur stdout (visible via docker logs).
# -u est indispensable : redirigée dans un tube, la sortie de Python est
# bufferisée par blocs, et le passage — qui dure 10 à 15 min — reste muet
# jusqu'à la fin. `docker logs` donne alors l'impression d'un blocage.
statut=0
python3 -u -m scraper.main 2>&1 | tee -a "$JOURNAL" || statut=$?

# Puis on prévient le site de consultation, qui vient rapatrier ce qui a été
# collecté. Sans cet appel, une collecte de nuit ne se voit sur le site qu'à la
# première visite d'un humain : c'est précisément ce qu'on ne veut pas.
#
# La notification part même quand le passage a échoué : la base du backend peut
# tout de même avoir avancé (un organisme sur cinq en erreur laisse les quatre
# autres à jour), et une synchronisation sans nouveauté ne coûte rien.
#
# Et elle ne décide jamais du sort du scrape : un site éteint ne doit pas faire
# passer une collecte réussie pour un échec dans les journaux.
# Chemin relatif au script (on a fait `cd` au début) : marche dans le conteneur
# comme en lancement direct depuis un clone.
python3 -u ./notifier_site.py 2>&1 | tee -a "$JOURNAL" || true

exit "$statut"
