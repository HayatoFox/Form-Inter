#!/usr/bin/env bash
# Trois modes :
#   cron   (défaut) : scrape au démarrage puis passages planifiés via cron
#   scrape          : un seul passage puis sortie
#   webapp          : site interne de consultation + back office
set -euo pipefail

CRON_SCHEDULE="${CRON_SCHEDULE:-0 6 * * *}"

# Les volumes sont montés root : on les rend accessibles à l'utilisateur
# "ubuntu" (uid 1000, aligné sur l'utilisateur hôte habituel) qui exécute
# le scrape, pour ne pas laisser de fichiers root sur l'hôte.
mkdir -p /app/data /app/logs
chown -R ubuntu:ubuntu /app/data /app/logs

case "${1:-cron}" in
    scrape)
        exec runuser -u ubuntu -- /app/run_scraper.sh
        ;;
    webapp)
        cd /app
        exec runuser -u ubuntu --preserve-environment -- python3 -m webapp
        ;;
    cron)
        # La sortie du job est renvoyée vers le stdout du conteneur (PID 1)
        # pour être visible dans `docker logs`.
        {
            echo "SHELL=/bin/bash"
            echo "PATH=/usr/local/bin:/usr/bin:/bin"
            echo "TZ=${TZ:-Europe/Paris}"
            echo "${CRON_SCHEDULE} ubuntu /app/run_scraper.sh >> /proc/1/fd/1 2>&1"
        } > /etc/cron.d/scraper
        chmod 0644 /etc/cron.d/scraper

        if [ "${SCRAPE_AT_STARTUP:-1}" = "1" ]; then
            echo "Scrape initial au démarrage..."
            runuser -u ubuntu -- /app/run_scraper.sh || echo "Scrape initial en erreur (voir logs), cron continue."
        fi

        echo "Cron démarré (planification : ${CRON_SCHEDULE})"
        exec cron -f
        ;;
    *)
        exec "$@"
        ;;
esac
