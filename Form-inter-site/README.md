# Form-inter-site — site de consultation des formations inter-entreprises

Application Next.js (App Router) + Prisma/SQLite : recherche publique des
formations et sessions, et back office d'administration.

Le catalogue se remplit par **deux chemins qui cohabitent** :

1. **Import manuel** d'un fichier Excel/CSV fourni par un organisme
   (`/admin/import`) ;
2. **Liaison dynamique avec le backend de veille** (`/admin/sources`), qui
   rapatrie les sessions collectées par les scrapers du dépôt Form-Inter.

Chaque ligne porte sa provenance (`source` = `MANUEL` ou `BACKEND`). La
synchronisation ne touche jamais aux données manuelles, et un import ne modifie
jamais une ligne rapatriée du backend.

## Démarrage

```bash
npm install                 # engendre aussi le client Prisma (postinstall)
cp .env.example .env        # puis renseigner les valeurs
npm run db:seed             # applique les migrations, puis les organismes
                            # de départ et le compte admin
npm run dev                 # http://localhost:3000
```

Le client Prisma est engendré dans `src/generated/`, **hors dépôt** : un clone
neuf ne l'a pas. Le script `postinstall` s'en charge ; en cas de doute,
`npx prisma generate` le refait.

## Tester en local, sans backend ni Docker

`npm run db:demo` remplit la base avec un catalogue réaliste — organismes,
domaines, villes et intitulés du métier — sans lancer le backend ni attendre
une collecte de quinze minutes. C'est le chemin le plus court pour juger
l'interface.

```bash
cd Form-inter-site
npm install                  # engendre le client Prisma au passage

cat > .env <<FIN
DATABASE_URL="file:./dev.db"
SESSION_SECRET="$(openssl rand -hex 32)"
ADMIN_EMAIL="admin@local"
ADMIN_PASSWORD_SEED="demo"
FIN

npm run db:demo      # applique les migrations, puis remplit le catalogue
npm run dev          # http://localhost:3000 — back office : admin@local / demo
```

Le jeu couvre volontairement ce qui fait tomber une mise en page : intitulés
très longs, sessions à entrée permanente sans dates, durées décimales
(« 0,5 jour »), disponibilité tendue (l'orange d'accent), tarifs absents,
sessions déjà passées. Il est **déterministe** : deux exécutions donnent le
même catalogue, donc deux captures d'écran restent comparables.

`db:seed`, `db:demo` et `db:setup` appliquent les migrations avant tout le
reste : sur un clone neuf, il n'y a pas d'étape `prisma migrate` à ne pas
oublier — sans elle, le seed échouait sur `The table main.Organisme does not
exist`.

`npm run db:info` répond en trois lignes à « où est la base et qu'y a-t-il
dedans » : chemin résolu, taille, comptes par table, et la commande à lancer
selon ce qui manque.

⚠ `db:demo` vide les données métier de la base visée. Il refuse de tourner avec
`NODE_ENV=production`.

Pour tester la chaîne complète avec le vrai backend, voir « Liaison avec le
backend » plus bas : lancer le webapp Python à côté (`python3 -m webapp` avec
`WEBAPP_API_TOKEN`), puis régler le mode `http` dans Admin › Sources de
données. Ou tout lancer en conteneurs avec `./deploy.sh` à la racine du dépôt.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Base SQLite du site, ex. `file:./dev.db` |
| `SESSION_SECRET` | Clé de signature du cookie d'administration (obligatoire) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_SEED` | Compte admin créé par `npm run db:seed` |
| `CRON_SECRET` | Jeton de `/api/cron/sync`. Non défini = endpoint fermé (503) |
| `COOKIE_SECURE` | Force le drapeau `Secure` du cookie d'admin. Détecté sinon depuis `X-Forwarded-Proto` |
| `BACKEND_MODE` | `off` (défaut), `http` ou `sqlite` |
| `BACKEND_URL` | Base de l'API du backend en mode `http`, ex. `http://localhost:8000` |
| `BACKEND_TOKEN` | Jeton porteur de l'API du backend (`WEBAPP_API_TOKEN` côté backend) |
| `BACKEND_DB_PATH` | Chemin de `formations.db` en mode `sqlite` (défaut `../data/formations.db`) |
| `BACKEND_AUTO_SYNC` | `1` (défaut) : resynchronise à la visite quand le catalogue est périmé |
| `BACKEND_SYNC_TTL_MINUTES` | Fraîcheur maximale avant resynchronisation (défaut 60) |
| `BACKEND_INCLURE_PASSEES` | `1` pour rapatrier aussi les sessions terminées (défaut `0`) |

Les réglages `BACKEND_*` ne sont que des **valeurs de départ** : ce qui est
enregistré depuis `/admin/sources` est stocké en base et l'emporte. On peut donc
livrer une image avec des défauts et les ajuster sans redéploiement.

## Liaison avec le backend

### Deux modes

- **`http`** — le backend expose son catalogue en JSON (`webapp/api.py` :
  `/api/sante` et `/api/sessions`, protégés par `WEBAPP_API_TOKEN`). Seul mode
  possible quand le site et le backend ne sont pas sur la même machine.
- **`sqlite`** — lecture directe de `data/formations.db`, quand les deux
  partagent le même volume. Le fichier est ouvert en lecture seule : le scraper
  reste le seul écrivain.

Les deux produisent exactement les mêmes lignes ; on passe de l'un à l'autre
sans conséquence sur les données déjà rapatriées.

### Ce que la synchronisation rapatrie

La vue `sessions_effectives` du backend (donc **corrections du back office du
backend incluses** : masquage, renommage, reclassement), limitée à l'« offre
courante » — le dernier passage du scraper, corrélé *par organisme*, pour qu'un
scraper en échec ne fasse pas disparaître son organisme.

Le modèle à plat du backend est éclaté dans le modèle du site :

| Backend | Site |
|---|---|
| `organisme` | `Organisme.nom` |
| `formation` | `Formation.intitule` |
| `type_formation` | `Formation.typeFormation` |
| `domaine` | `Domaine.nom` |
| `ville` | `Centre.nom` / `Centre.ville` |
| `date_debut` / `date_fin` | `Session.dateDebut` / `dateFin` (nulles = entrée/sortie permanente) |
| `duree_jours` | `Session.dureeJours` |
| `tarif`, `remarque`, `disponibilite` | `Session.tarif`, `remarque`, `placesInfo` |
| `url_programme`, `source_url` | `Session.urlProgramme`, `sourceUrl` |
| `first_seen`, `last_seen` | `Session.firstSeen`, `lastSeen` |

Les organismes, domaines, centres et formations sont rapprochés **sans tenir
compte de la casse ni des accents** : « Cepim » saisi à la main et « CEPIM »
scrapé désignent la même entité.

### Garde-fous

- Un lot vide **interrompt** le passage plutôt que de vider le catalogue.
- Une pagination tronquée lève une erreur au lieu de livrer un lot partiel.
- Un seul passage à la fois (verrou en base avec expiration).
- Rien de ce qui porte `source = MANUEL` n'est modifié ni supprimé.

### Déclenchement

- **À la main** : `/admin/sources` › « Synchroniser maintenant ».
- **Automatique** : à la visite de `/formations` ou `/admin` quand le dernier
  passage réussi dépasse la fraîcheur demandée. Le travail part *après* la
  réponse (`after()` de Next.js) : le visiteur ne l'attend pas.
- **Planifié** : depuis un cron système,

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/sync
  ```

## Direction artistique

Ancrée sur l'identité PROINSEC — bleu `#0072b1`, orange `#ff6900`, encre
`#1c2733`, les mêmes que le site de veille interne — mais traitée en produit :
respiration, hiérarchie typographique, élévation basse. Les arbitrages penchent
vers l'outil de travail : c'est l'équipe qui balaie le catalogue toute la
journée.

Trois règles tiennent l'ensemble :

**Aucun composant n'écrit `dark:`.** Les jetons sémantiques (`surface`, `texte`,
`bordure`, `marque`, `action`…) basculent dans `globals.css` et sont exposés en
utilitaires Tailwind par `@theme inline`. Un seul endroit à relire pour vérifier
le thème sombre, et aucune paire de classes à maintenir en double. Les recettes
partagées (cartes, boutons, champs) vivent dans `src/lib/ui.ts`.

**Le domaine est une teinte, pas une couleur.** `src/lib/domaines.ts` associe à
chacun des quatorze domaines une teinte oklch ; `.pastille` fixe la clarté et le
chroma. Toutes les pastilles ont donc le même poids visuel et le même contraste
dans les deux thèmes — ce qu'une liste de codes hexadécimaux choisis un par un
ne sait pas garantir. Un domaine inconnu reçoit une teinte dérivée de son nom,
stable d'une page à l'autre. C'est la signature du site : la même pastille dans
la carte, le filtre, la fiche et la modale, plus le liseré du même ton à gauche
des cartes.

**L'orange est rare et signifiant.** Il ne sort que lorsque la disponibilité se
tend (« dernières places », « complet ») ; partout ailleurs le gris suffit. Un
accent qui sert partout ne signale plus rien.

## Dates

Toutes les dates du site sont des **dates calendaires** stockées à minuit UTC et
affichées en UTC (`src/lib/dates.ts`). Sans cette convention, une date importée
à minuit local s'affiche la veille dès que le serveur et le lecteur ne sont pas
dans le même fuseau — et le backend, lui, ne transmet que des `AAAA-MM-JJ`.

## Nettoyage des sessions passées

Les sessions **manuelles** terminées sont supprimées à la visite de
`/formations` et `/admin` (il n'y a pas de tâche de fond). Les sessions issues
du backend ne sont pas concernées : elles disparaissent d'elles-mêmes quand
l'organisme cesse de les publier.
