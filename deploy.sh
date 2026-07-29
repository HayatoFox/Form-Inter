#!/usr/bin/env bash
# Déploiement Docker de Form-Inter (Linux et macOS) : collecte + site interne
# + site de consultation, en une commande.
#
#   ./deploy.sh            démarre tout (construit les images si besoin)
#   ./deploy.sh status     état des trois services
#   ./deploy.sh logs [svc] journaux (Ctrl-C pour sortir)
#   ./deploy.sh sync       force une synchronisation site <- backend
#   ./deploy.sh scrape     lance un passage de collecte immédiat
#   ./deploy.sh secrets    réaffiche les identifiants engendrés
#   ./deploy.sh restart    redémarre les services
#   ./deploy.sh stop       arrête les services (les données restent)
#   ./deploy.sh down       arrête et supprime les conteneurs (données gardées)
#
# Les secrets sont engendrés au premier lancement dans .env (chmod 600) et
# jamais réécrits ensuite : ce fichier est la mémoire de l'installation.
# Écrit pour rester compatible avec le bash 3.2 de macOS.

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RACINE"
FICHIER_ENV="$RACINE/.env"

# --- Affichage ---------------------------------------------------------------

if [ -t 1 ]; then
    GRAS=$'\033[1m'; ROUGE=$'\033[31m'; VERT=$'\033[32m'
    JAUNE=$'\033[33m'; FIN=$'\033[0m'
else
    GRAS=''; ROUGE=''; VERT=''; JAUNE=''; FIN=''
fi

info()   { printf '%s\n' "$*"; }
etape()  { printf '\n%s==>%s %s%s%s\n' "$VERT" "$FIN" "$GRAS" "$*" "$FIN"; }
avert()  { printf '%s!%s  %s\n' "$JAUNE" "$FIN" "$*" >&2; }
echec()  { printf '%serreur :%s %s\n' "$ROUGE" "$FIN" "$*" >&2; exit 1; }

# --- Prérequis ---------------------------------------------------------------

COMPOSE=""

verifier_docker() {
    command -v docker >/dev/null 2>&1 \
        || echec "Docker n'est pas installé. Voir https://docs.docker.com/get-docker/"

    docker info >/dev/null 2>&1 || echec \
"Le démon Docker ne répond pas.
  - macOS : lancer Docker Desktop et attendre qu'il soit prêt.
  - Linux : sudo systemctl start docker (et ajouter votre compte au groupe docker)."

    if docker compose version >/dev/null 2>&1; then
        COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        echec "Ni « docker compose » ni « docker-compose » n'est disponible."
    fi
}

# --- Fichier .env ------------------------------------------------------------

# Chaîne hexadécimale aléatoire de N octets. openssl est présent partout sur
# macOS comme sur Linux ; /dev/urandom sert de repli.
aleatoire() {
    local octets="$1"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$octets"
    else
        dd if=/dev/urandom bs=1 count="$octets" 2>/dev/null \
            | od -An -tx1 | tr -d ' \n'
        printf '\n'
    fi
}

# N'ajoute la clé que si elle est absente : relancer le script ne fait jamais
# tourner un secret déjà en service.
poser_defaut() {
    local cle="$1" valeur="$2"
    if ! grep -q "^${cle}=" "$FICHIER_ENV" 2>/dev/null; then
        printf '%s=%s\n' "$cle" "$valeur" >> "$FICHIER_ENV"
    fi
}

valeur_env() {
    local cle="$1"
    grep "^${cle}=" "$FICHIER_ENV" 2>/dev/null | head -n 1 | cut -d= -f2- || true
}

preparer_env() {
    local nouveau=0
    if [ ! -f "$FICHIER_ENV" ]; then
        nouveau=1
        cat > "$FICHIER_ENV" <<'ENTETE'
# Configuration du déploiement Docker de Form-Inter.
# Engendré par ./deploy.sh — les secrets ci-dessous ne sont jamais réécrits.
# Ne pas versionner ce fichier.
ENTETE
    fi

    poser_defaut TZ                       "Europe/Paris"

    # Collecte
    poser_defaut CRON_SCHEDULE            "0 6 * * *"
    poser_defaut SCRAPE_AT_STARTUP        "1"

    # Site interne (webapp Python)
    poser_defaut WEBAPP_PORT              "8000"
    poser_defaut WEBAPP_ADMIN_USER        "admin"
    poser_defaut WEBAPP_ADMIN_PASSWORD    "$(aleatoire 12)"
    poser_defaut WEBAPP_API_TOKEN         "$(aleatoire 32)"

    # Site de consultation (Next.js)
    poser_defaut SITE_PORT                "3000"
    poser_defaut SITE_ADMIN_EMAIL         "admin@example.com"
    poser_defaut SITE_ADMIN_PASSWORD      "$(aleatoire 12)"
    poser_defaut SESSION_SECRET           "$(aleatoire 32)"
    poser_defaut CRON_SECRET              "$(aleatoire 32)"

    # Liaison site <- backend
    poser_defaut BACKEND_MODE             "http"
    poser_defaut BACKEND_AUTO_SYNC        "1"
    poser_defaut BACKEND_SYNC_TTL_MINUTES "60"
    poser_defaut BACKEND_INCLURE_PASSEES  "0"

    chmod 600 "$FICHIER_ENV"

    if [ "$nouveau" = 1 ]; then
        etape "Secrets engendrés dans .env"
        info "Mots de passe et jetons créés pour cette installation."
        info "Sauvegardez ce fichier : il ne sera pas réengendré."
    fi
}

# --- Attente de disponibilité ------------------------------------------------

attendre_sante() {
    local conteneur="$1" libelle="$2" delai="${3:-240}"
    local ecoule=0 etat

    printf '    %s ' "$libelle"
    while [ "$ecoule" -lt "$delai" ]; do
        etat="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
                "$conteneur" 2>/dev/null || echo absent)"
        case "$etat" in
            healthy|running)
                printf '%sOK%s\n' "$VERT" "$FIN"; return 0 ;;
            unhealthy|exited|dead)
                printf '%séchec (%s)%s\n' "$ROUGE" "$etat" "$FIN"
                avert "Voir : ./deploy.sh logs ${conteneur#scrap-}"
                return 1 ;;
        esac
        sleep 3
        ecoule=$((ecoule + 3))
        printf '.'
    done
    printf '%sdélai dépassé%s\n' "$JAUNE" "$FIN"
    avert "Voir : ./deploy.sh logs ${conteneur#scrap-}"
    return 1
}

# --- Commandes ---------------------------------------------------------------

resume() {
    local port_site port_webapp
    port_site="$(valeur_env SITE_PORT)"
    port_webapp="$(valeur_env WEBAPP_PORT)"

    etape "Prêt"
    printf '  %sSite de consultation%s  http://localhost:%s\n' "$GRAS" "$FIN" "${port_site:-3000}"
    printf '    back office           http://localhost:%s/admin\n' "${port_site:-3000}"
    printf '    identifiants          %s / %s\n' \
        "$(valeur_env SITE_ADMIN_EMAIL)" "$(valeur_env SITE_ADMIN_PASSWORD)"
    printf '\n  %sSite interne (veille)%s http://localhost:%s\n' "$GRAS" "$FIN" "${port_webapp:-8000}"
    printf '    identifiants          %s / %s\n' \
        "$(valeur_env WEBAPP_ADMIN_USER)" "$(valeur_env WEBAPP_ADMIN_PASSWORD)"
    printf '\n'
    info "  Ces ports n'ont pas de HTTPS : à garder sur le LAN ou le VPN."
}

commande_up() {
    verifier_docker
    preparer_env

    mkdir -p data logs data-site

    etape "Construction et démarrage des images"
    info "La première construction du site prend plusieurs minutes (npm + build Next)."
    $COMPOSE up -d --build

    etape "Attente des services"
    attendre_sante scrap-webapp "site interne " || true
    attendre_sante scrap-site   "site public  " || true

    if [ "$(valeur_env SCRAPE_AT_STARTUP)" = "1" ]; then
        etape "Collecte initiale en cours"
        info "Les cinq organismes sont scrapés en arrière-plan (~10 à 15 min)."
        info "Suivre : ./deploy.sh logs scraper"
        info "Le site se remplira à la synchronisation suivante — ou tout de suite"
        info "une fois la collecte terminée, avec : ./deploy.sh sync"
    fi

    resume
}

commande_sync() {
    verifier_docker
    etape "Synchronisation site <- backend"
    docker exec scrap-site node -e '
      const jeton = process.env.CRON_SECRET;
      if (!jeton) { console.error("CRON_SECRET absent du conteneur"); process.exit(1); }
      fetch("http://localhost:3000/api/cron/sync", {
        headers: { Authorization: "Bearer " + jeton },
      })
        .then((r) => r.text())
        .then((t) => console.log(t))
        .catch((e) => { console.error(String(e)); process.exit(1); });
    '
}

commande_scrape() {
    verifier_docker
    etape "Passage de collecte immédiat"
    info "Compter 10 à 15 minutes."
    $COMPOSE run --rm scraper scrape
}

commande_status() {
    verifier_docker
    $COMPOSE ps
}

commande_logs() {
    verifier_docker
    if [ $# -gt 0 ]; then
        $COMPOSE logs -f --tail=100 "$@"
    else
        $COMPOSE logs -f --tail=50
    fi
}

commande_secrets() {
    [ -f "$FICHIER_ENV" ] || echec "Aucun .env : lancez d'abord ./deploy.sh"
    resume
}

# Le bandeau de commentaires en tête de ce fichier fait office d'aide :
# on le réimprime jusqu'à la première ligne de code.
usage() {
    awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"
}

# --- Aiguillage --------------------------------------------------------------

commande="${1:-up}"
[ $# -gt 0 ] && shift || true

case "$commande" in
    up|start|"")   commande_up ;;
    sync)          commande_sync ;;
    scrape)        commande_scrape ;;
    status|ps)     commande_status ;;
    logs)          commande_logs "$@" ;;
    secrets)       commande_secrets ;;
    restart)       verifier_docker; $COMPOSE restart "$@" ;;
    stop)          verifier_docker; $COMPOSE stop ;;
    down)          verifier_docker; $COMPOSE down ;;
    -h|--help|help) usage ;;
    *)             avert "Commande inconnue : $commande"; usage; exit 1 ;;
esac
