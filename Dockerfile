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
# webapp/static/app/ contient le build de l'interface (frontend/), commité :
# l'image n'a donc besoin ni de Node ni d'accès au registre npm. Après une
# modification du front, penser à `npm --prefix frontend run build` et à
# commiter le résultat avant de reconstruire l'image.
COPY webapp/ webapp/
COPY run_scraper.sh docker-entrypoint.sh ./
RUN chmod +x run_scraper.sh docker-entrypoint.sh \
 && test -f webapp/static/app/index.html \
    || (echo "ERREUR : interface non construite (webapp/static/app/index.html absent)." \
        && echo "Lancez 'npm --prefix frontend install && npm --prefix frontend run build'." \
        && exit 1)

VOLUME ["/app/data", "/app/logs"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
# "cron" = mode service (planifié) ; remplacer par "scrape" pour un passage unique
CMD ["cron"]
