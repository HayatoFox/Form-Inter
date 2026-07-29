# Form-Inter — site de consultation (frontend seul)

Cette branche ne contient que le **site** : l'application Next.js de
[`Form-inter-site/`](Form-inter-site/). Le backend de veille (scrapers Python,
site interne stdlib, base SQLite, compose et script de déploiement des trois
services) vit sur la branche `claude/site-et-backend`, avec ce même site aux
mêmes chemins et au même contenu — les deux branches restent donc directement
comparables et fusionnables.

```bash
cd Form-inter-site
npm install
cp .env.example .env        # puis renseigner les valeurs
npx prisma migrate deploy
npm run db:seed
npm run dev                 # http://localhost:3000
```

En conteneur, le site a sa propre image :

```bash
docker build -t form-inter-site ./Form-inter-site
docker run -d --name form-inter-site -p 3000:3000 \
  -e DATABASE_URL="file:/app/site/data/site.db" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL="admin@example.com" \
  -e ADMIN_PASSWORD_SEED="$(openssl rand -hex 12)" \
  -e BACKEND_MODE="http" \
  -e BACKEND_URL="http://<hôte-du-backend>:8000" \
  -e BACKEND_TOKEN="<WEBAPP_API_TOKEN du backend>" \
  -v "$PWD/data-site:/app/site/data" \
  form-inter-site
```

Les migrations et le compte admin initial sont posés au premier démarrage par
`Form-inter-site/docker-entrypoint.sh`.

Si la page de connexion revient en boucle malgré un identifiant correct, c'est
le cookie qui n'est pas accepté : il n'est marqué `Secure` que lorsque la
requête arrive en HTTPS. Derrière un reverse proxy TLS qui ne pose pas
`X-Forwarded-Proto`, ajouter `-e COOKIE_SECURE=1`.

## Deux sources de données

Le catalogue se remplit par deux chemins qui cohabitent, chaque ligne portant sa
provenance (`MANUEL` ou `BACKEND`) :

1. **Import Excel/CSV** d'un fichier transmis par un organisme
   (`/admin/import`) — assistant fichier → mapping → aperçu → import.
2. **Liaison dynamique avec le backend de veille** (`/admin/sources`), au
   choix :
   - **`http`** — le backend expose son catalogue en JSON (`/api/sante`,
     `/api/sessions`, jeton porteur). Seul mode possible quand le site et le
     backend ne sont pas sur la même machine ;
   - **`sqlite`** — lecture seule de `data/formations.db` du backend, quand les
     deux partagent le même volume.

La synchronisation ne touche jamais aux données manuelles, et un import ne
modifie jamais une ligne rapatriée du backend. Sans backend configuré
(`BACKEND_MODE=off`, le défaut), le site fonctionne uniquement sur ses imports.

Le détail — mapping des champs, garde-fous, déclenchement automatique et
planifié, variables d'environnement — est dans
[`Form-inter-site/README.md`](Form-inter-site/README.md).
