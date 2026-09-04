FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Europe/Paris

# Le scraper n'utilise que la stdlib Python : pas de pip nécessaire.
# ca-certificates est requis pour les requêtes HTTPS d'urllib.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        python3 \
        cron \
        tzdata \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scraper/ scraper/
COPY webapp/ webapp/
COPY run_scraper.sh docker-entrypoint.sh notifier_site.py ./
RUN chmod +x run_scraper.sh docker-entrypoint.sh notifier_site.py

VOLUME ["/app/data", "/app/logs"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
# "cron" = mode service (planifié) ; remplacer par "scrape" pour un passage unique
CMD ["cron"]
