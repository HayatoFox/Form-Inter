#!/usr/bin/env bash
# Démarrage du site : migrations, compte admin au premier lancement, serveur.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL est requis (ex. file:/app/site/data/site.db)}"
: "${SESSION_SECRET:?SESSION_SECRET est requis}"

fichier_base="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$fichier_base")"

# Le compte admin n'est créé qu'au tout premier démarrage, comme le fait le
# backend : relancer le conteneur ne réécrit pas un mot de passe changé depuis.
premier_demarrage=0
[ -f "$fichier_base" ] || premier_demarrage=1

echo "[site] Application des migrations…"
npx prisma migrate deploy

if [ "$premier_demarrage" = 1 ]; then
    if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD_SEED:-}" ]; then
        echo "[site] Premier démarrage : organismes de départ + compte ${ADMIN_EMAIL}"
        npm run db:seed
    else
        echo "[site] Premier démarrage sans ADMIN_EMAIL/ADMIN_PASSWORD_SEED :" \
             "aucun compte admin créé, /admin restera inaccessible." >&2
    fi
fi

echo "[site] En écoute sur http://0.0.0.0:${PORT:-3000}"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
