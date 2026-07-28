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
# Sortie journalisée dans logs/ et renvoyée sur stdout (visible via docker logs)
python3 -m scraper.main 2>&1 | tee -a "$JOURNAL"
