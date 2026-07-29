# Image du site de consultation (Next.js + Prisma/SQLite).
#
# Volontairement en une seule étape, sans `output: "standalone"` : le site
# embarque deux modules natifs (better-sqlite3) et des fichiers générés hors
# dépôt (le client Prisma dans src/generated), que le traçage de fichiers de
# Next gère mal. Une image un peu plus grosse pour un outil interne coûte moins
# cher qu'un démarrage qui échoue à cause d'un binaire non copié.
FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# better-sqlite3 se compile quand aucun binaire précompilé ne correspond à la
# plateforme (fréquent sur arm64 / Apple Silicon).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Le site est en /app/site et la base du backend est montée en /app/data :
# le chemin par défaut de la liaison SQLite (../data/formations.db) tombe
# donc juste sans rien configurer.
WORKDIR /app/site

# `npm ci` installe aussi les devDependencies : la CLI Prisma (migrations),
# tsx (le seed) et dotenv (lu par prisma.config.ts) servent au démarrage.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# Le client Prisma est généré dans src/generated, hors dépôt : il doit exister
# avant le build.
RUN npx prisma generate && npm run build

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/app/site/data"]

ENTRYPOINT ["/app/site/docker-entrypoint.sh"]
