#!/usr/bin/env bash
# Point d'entrée cron : lance le scrape et journalise dans logs/.
# Verrou partagé avec le scrape manuel du back office (data/.scrape.lock) :
# si l'un tourne, l'autre s'efface proprement.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p logs data
JOURNAL="logs/scrape_$(date +%Y-%m).log"

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
python3 -u -m scraper.main 2>&1 | tee -a "$JOURNAL"
