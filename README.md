# Scrap formations

Collecte automatisée (cron) des sessions de formation de différents organismes
vers une base SQLite, avec site web interne de consultation/tri et back
office admin (PROINSEC).

## Site web interne (`webapp/`)

Serveur 100 % stdlib Python (`ThreadingHTTPServer`), zéro dépendance, zéro
JavaScript. Lancement local : `python3 -m webapp` (port 8000, `--port` pour
changer) ; via Docker : service `webapp` du compose (ci-dessous).

- **Connexion obligatoire** (comptes internes ; SSO envisageable plus tard,
  `webapp/auth.py` est isolé pour ça). Au premier démarrage, le compte admin
  initial est créé depuis `WEBAPP_ADMIN_USER` / `WEBAPP_ADMIN_PASSWORD`
  (mot de passe généré et affiché en console sinon).
- **Liste des sessions** : filtres combinables (domaine, organisme, ville,
  dates, durée, recherche, passées/permanentes/historique) appliqués par un
  unique bouton « Filtrer » — une requête par action, aucun appel dynamique.
  Tri par colonne, pagination (50/page), exports CSV et Excel du résultat
  filtré. Par défaut : offre courante, sessions à venir + permanentes.
- **Back office** (rôle admin) : corrections durables de sessions (masquer,
  renommer, reclasser, note interne — survivent aux scrapes via la table
  `overrides` appliquée en lecture), santé des scrapers (alertes échec /
  chute de volume / cron muet), scrape manuel avec verrou anti-collision
  cron (`data/.scrape.lock`, flock), statistiques, gestion des comptes.
- Sécurité : SQL paramétré, échappement HTML systématique, scrypt pour les
  mots de passe, cookies signés HMAC, CSRF sur tous les POST. Le port doit
  rester sur le LAN/VPN (pas de HTTPS intégré).

### API JSON (`webapp/api.py`)

Deux endpoints en lecture seule, destinés au site Next.js `Form-inter-site/`
qui rapatrie le catalogue :

| Endpoint | Contenu |
|---|---|
| `GET /api/sante` | nombre de sessions, d'organismes, date du dernier scrape |
| `GET /api/sessions` | catalogue paginé (`page`, `par_page`, `passees=1`, `depuis=AAAA-MM-JJ`) |

Ils publient la vue `sessions_effectives` (corrections du back office
comprises) limitée à l'offre courante par organisme, et **excluent par défaut
les sessions terminées**.

Ces routes ne passent pas par le cookie de session mais par un jeton porteur :

```bash
curl -H "Authorization: Bearer $WEBAPP_API_TOKEN" http://localhost:8000/api/sante
```

**Tant que `WEBAPP_API_TOKEN` n'est pas défini, l'API répond 503** : rien ne
s'ouvre par accident sur une installation existante.

## Site de consultation (`Form-inter-site/`)

Application Next.js + Prisma/SQLite, avec son propre back office. Elle se
remplit par deux chemins qui cohabitent : l'import de fichiers Excel/CSV
transmis par les organismes, et la liaison dynamique avec la base de ce dépôt —
soit par l'API JSON ci-dessus, soit par lecture directe de
`data/formations.db` quand les deux tournent sur la même machine. Voir
[`Form-inter-site/README.md`](Form-inter-site/README.md).

## Lancement

```bash
python3 -m scraper.main
```

Aucune dépendance externe : bibliothèque standard Python uniquement
(urllib, sqlite3, re). La base est créée automatiquement dans
`data/formations.db`.

## Docker (recommandé)

### En une commande — `./deploy.sh`

Script de déploiement pour **Linux et macOS** : il vérifie Docker, engendre les
mots de passe et jetons dans `.env` au premier lancement, construit les images,
démarre les trois services, attend qu'ils répondent et affiche les
identifiants.

```bash
./deploy.sh
```

| Commande | Effet |
|---|---|
| `./deploy.sh` | démarre tout (construit les images si besoin) |
| `./deploy.sh status` | état des trois services |
| `./deploy.sh logs [svc]` | journaux en continu (`scraper`, `webapp`, `site`) |
| `./deploy.sh sync` | force une synchronisation site ← backend |
| `./deploy.sh scrape` | lance un passage de collecte immédiat |
| `./deploy.sh secrets` | réaffiche les URL et identifiants |
| `./deploy.sh stop` / `down` | arrête (les données restent dans `./data`, `./data-site`) |

Les secrets ne sont **jamais réécrits** : `.env` est la mémoire de
l'installation, à sauvegarder. `.env.example` liste tout ce qui est réglable
(ports, planification, mode de liaison).

La première construction prend plusieurs minutes (installation npm et build
Next.js) et nécessite un accès réseau sortant vers le registre npm,
`cdn.sheetjs.com` (la dépendance `xlsx`) et GitHub (binaires précompilés de
`better-sqlite3`).

#### Ne pas lancer le script avec `sudo` sur macOS

Docker Desktop tourne sous votre compte : c'est **son** démon qui crée les
montages, `sudo` ne lui donne aucun droit supplémentaire. En revanche il laisse
dans le projet des fichiers appartenant à root — à commencer par `.env` en
chmod 600 — que le lancement normal suivant ne saura plus lire. Le script
refuse désormais de démarrer en root sur macOS. Si c'est déjà arrivé :

```bash
sudo chown -R "$(id -un)" .
./deploy.sh
```

Sur Linux, `sudo` reste légitime si votre compte n'est pas dans le groupe
`docker`.

#### « error while creating mount source path … operation not permitted »

macOS protège `~/Documents`, `~/Bureau` et `~/Téléchargements` : Docker Desktop
n'y a pas accès tant qu'il n'y est pas autorisé, ne *voit* donc pas le dossier,
croit devoir le créer et échoue. Deux issues :

1. Réglages système › Confidentialité et sécurité › **Fichiers et dossiers** →
   activer « Dossier Documents » pour Docker (ou Accès complet au disque), puis
   redémarrer Docker Desktop. Vérifier aussi que `/Users` figure dans Docker
   Desktop › Settings › Resources › **File sharing**.
2. Si la machine interdit ces autorisations, sortir les données du dossier
   protégé **sans déplacer le dépôt**, en réglant dans `.env` :

   ```
   DATA_DIR=$HOME/form-inter/data
   LOGS_DIR=$HOME/form-inter/logs
   SITE_DATA_DIR=$HOME/form-inter/data-site
   ```

`./deploy.sh` relit la sortie de Docker et affiche cette marche à suivre
lui-même quand il reconnaît l'erreur.

#### Le premier démarrage met 10 à 15 minutes à se remplir

Le conteneur `scraper` lance une collecte complète au démarrage. Pendant ce
temps :

- `./deploy.sh logs scraper` affiche l'avancement organisme par organisme ;
- le site **ne se synchronise pas** : `/api/sante` du backend signale la
  collecte en cours, et le site reporte le rapatriement plutôt que de
  rapatrier un catalogue à moitié écrit (les organismes pas encore scrapés
  n'ont aucune session courante). Les passages reportés apparaissent en
  « Reporté » dans Admin › Sources de données ;
- une fois la collecte finie, le scraper prévient lui-même le site, qui
  rapatrie dans la foulée (voir « Mise à jour quotidienne » ci-dessous). Pour
  ne pas attendre, `./deploy.sh sync` force le passage.

#### « Le site affiche 200 formations, le site de veille 3 900 sessions »

Ce n'est pas une perte de données : les deux ne comptent pas la même chose. Une
**formation** regroupe toutes ses dates et tous ses lieux, une **session** est
une occurrence datée. Quelques centaines de formations pour quelques milliers
de sessions est le rapport attendu. La page `/formations` affiche désormais les
deux nombres, et Admin › Sources de données donne le total de sessions
synchronisées, directement comparable au site de veille.

#### Connexion impossible au back office du site

Si l'identifiant est bon mais que la page de connexion revient en boucle, c'est
le cookie qui n'est pas accepté. Le site ne marque le cookie `Secure` que si la
requête arrive en HTTPS ; derrière un reverse proxy TLS qui ne pose pas
`X-Forwarded-Proto`, régler `COOKIE_SECURE=1` dans `.env`. En accès HTTP direct
sur le LAN, laisser à `0`.

Les identifiants sont dans `.env` et réaffichables avec `./deploy.sh secrets`.

### Mise à jour quotidienne

Le catalogue se rafraîchit tout seul, une fois par nuit, sans que personne
n'ait à ouvrir une page :

1. à `CRON_SCHEDULE` (défaut `0 2 * * *`, heure de Paris), le conteneur
   `scraper` lance sa collecte ;
2. à la fin du passage, `run_scraper.sh` appelle `notifier_site.py`, qui
   demande au site de rapatrier — un POST sur `/api/cron/sync`, authentifié
   par `CRON_SECRET` ;
3. le site met à jour son catalogue et invalide ses pages.

Le déclencheur est la **fin de la collecte**, et pas une seconde tâche
planifiée à une heure fixe : un passage dure dix à quinze minutes, mais cela
dépend des sites scrapés, et un ordonnanceur indépendant se tromperait les
jours où il déborde.

Ce que ça donne dans `./deploy.sh logs scraper` :

```
2026-08-31 02:14:07 : Site : synchronisation demandée à http://site:3000/api/cron/sync
2026-08-31 02:14:31 : Site : synchronisé — 3874 ligne(s) reçue(s), 41 session(s) ajoutée(s), 12 mise(s) à jour, 208 retirée(s).
```

Quelques garde-fous :

- si le site est éteint ou redémarre, la notification échoue **sans faire
  passer une collecte réussie pour un échec** : la base du backend est à jour,
  et le site rattrapera à la visite suivante ou au passage du lendemain ;
- la notification part même quand le scrape a échoué : un organisme sur cinq
  en erreur laisse les quatre autres à jour ;
- `SITE_SYNC_URL` vide dans `.env` désactive complètement le mécanisme — le
  scraper reste utilisable seul, sans site en face ;
- `BACKEND_AUTO_SYNC=1` garde en plus le rafraîchissement à la visite quand le
  dernier passage réussi date de plus de `BACKEND_SYNC_TTL_MINUTES` : c'est le
  filet, plus le mécanisme principal.

La date du dernier passage est lisible dans Admin › Sources de données, et le
tableau de bord signale une synchronisation anormalement ancienne.

### Les trois services

Image Ubuntu 24.04 pour les deux premiers (cron intégré, aucune dépendance
Python), image Node 22 pour le site.

| Service | Conteneur | Port | Rôle |
|---|---|---|---|
| `scraper` | `scrap-formations` | — | collecte quotidienne (`CRON_SCHEDULE`, défaut 2 h ; `SCRAPE_AT_STARTUP=0` désactive le passage initial) |
| `webapp` | `scrap-webapp` | 8000 | site interne de veille + API JSON |
| `site` | `scrap-site` | 3000 | site de consultation Next.js |

Le site interroge le backend par le réseau du compose
(`BACKEND_MODE=http`, `http://webapp:8000`) : aucun fichier partagé entre eux,
donc aucun verrou SQLite à faire cohabiter entre conteneurs. Pour lire
directement la base à la place, passer `BACKEND_MODE=sqlite` dans `.env` et
décommenter le montage de `./data` sur le service `site`.

La BDD de veille et les logs sont montés depuis l'hôte (`./data`, `./logs`),
la base propre au site dans `./data-site`. Attention : `./data` ne doit jamais
être sur NFS/CIFS (verrous SQLite). Ces ports n'ont pas de HTTPS : à garder sur
le LAN ou le VPN.

### Exposer le site sur un domaine (Apache déjà en place)

Le serveur utilise Apache comme reverse proxy : l'hôte virtuel prêt à l'emploi
est dans [`apache/forminter.conf`](apache/forminter.conf) (forminter.proinsec.com
→ conteneur du site, port 3000).

```bash
sudo a2enmod proxy proxy_http headers ssl
sudo cp apache/forminter.conf /etc/apache2/sites-available/forminter.conf
sudo a2ensite forminter
sudo apachectl configtest && sudo systemctl restart apache2

# Certificat : certbot crée lui-même le vhost 443 (copie du vhost 80 + TLS).
# Répondre « Redirect » pour basculer tout le trafic en HTTPS.
sudo certbot --apache -d forminter.proinsec.com
```

Le vhost fourni est **en port 80 seul**, c'est voulu : un bloc `:443` écrit à
la main avec `SSLEngine on` mais sans certificat empêche Apache de démarrer —
et certbot a besoin d'un Apache qui tourne.

Deux directives de cette conf sont **indispensables**, leur absence donne des
pannes silencieuses :

- `ProxyPreserveHost On` — Next.js vérifie que l'origine des formulaires du
  back office correspond à l'hôte : sans elle, tous les POST sont rejetés ;
- `RequestHeader set X-Forwarded-Proto "expr=%{REQUEST_SCHEME}"` — c'est cet
  en-tête qui fait passer le cookie d'administration en `Secure` (la forme
  `expr=` reste juste dans le vhost 80 comme dans le 443 créé par certbot).

Une fois le proxy en service, restreindre le port du site à la boucle locale
dans `.env`, puis relancer :

```
SITE_BIND=127.0.0.1
```

Le site interne de veille (port 8000) reste volontairement hors du proxy, sur
le LAN/VPN.

### Sans le script

```bash
cp .env.example .env   # puis renseigner mots de passe et secrets
docker compose up -d --build
docker compose run --rm scraper scrape   # passage unique
```

Le scrape s'exécute sous l'utilisateur `ubuntu` (uid 1000) du conteneur :
les fichiers créés dans `./data` restent donc à l'utilisateur hôte.

## Cron (sans Docker)

`run_scraper.sh` est le point d'entrée prévu pour cron (journalise dans
`logs/scrape_AAAA-MM.log`). Exemple pour un passage quotidien à 2 h :

```
0 2 * * * SITE_SYNC_URL=https://forminter.exemple.com/api/cron/sync CRON_SECRET=... /chemin/vers/run_scraper.sh
```

(à ajouter via `crontab -e`)

Les deux variables sont facultatives : sans elles, le scrape a lieu et le site
n'est pas prévenu. Avec elles, il se met à jour dans la foulée — c'est le même
mécanisme que sous Docker, où l'entrypoint les dépose dans `/app/.env-cron`
parce que cron ne transmet pas l'environnement du conteneur.

## Schéma de la base

Table `sessions` — une ligne par session (organisme + formation + ville + dates) :

| colonne          | contenu                                              |
|------------------|------------------------------------------------------|
| `organisme`      | ex. « TEMIS Formation »                              |
| `formation`      | intitulé de la formation                             |
| `type_formation` | catégorie **d'origine du site** (libellés hétérogènes) |
| `domaine`        | classification **commune** (14 domaines : Secourisme, CACES / Conduite d'engins, Habilitations électriques… — règles dans `scraper/domaines.py`) |
| `ville`          | ville de l'antenne/du centre                         |
| `date_debut`     | ISO `AAAA-MM-JJ`                                     |
| `date_fin`       | ISO `AAAA-MM-JJ`                                     |
| `duree_jours`    | durée en jours (peut être décimale, ex. 0.5)         |
| `tarif`          | texte brut du site (ex. « 630 € H.T/pers »)          |
| `remarque`       | ex. « Session ouverte toutes les semaines »          |
| `disponibilite`  | ex. « Places disponibles », « Dernières places »     |
| `url_programme`  | lien vers la fiche programme (si présent)            |
| `source_url`     | page d'où provient la session                        |
| `first_seen`     | date du scrape où la session est apparue             |
| `last_seen`      | date du dernier scrape où elle était encore affichée |

`date_debut`/`date_fin` à NULL signifient une session à **entrée/sortie
permanente** (offre ouverte en continu, cas PILOCAP).

Une session retirée du site n'est pas supprimée : son `last_seen` cesse
simplement d'avancer. Pour le site de tri, filtrer sur
`last_seen = (SELECT MAX(last_seen) FROM sessions)` donne l'offre courante.

## Ajouter un organisme

1. Créer `scraper/sites/<nom>.py` exposant `ORGANISME` (str) et
   `scrape() -> list[dict]` (mêmes clés que le schéma, hors `first_seen`/`last_seen`
   et `domaine`, calculés par le pipeline).
2. L'ajouter à `SCRAPERS` dans `scraper/main.py`.

`main.assainir()` post-traite chaque session : calcul du `domaine` et
garde-fou sur les dates incohérentes (fin < début, coquilles des sites :
ramenées à 1 jour, affichage d'origine consigné dans `remarque`).

Chaque scraper est indépendant : une panne sur un site n'empêche pas les
autres de tourner (erreur journalisée, code retour ≠ 0).

## Sites couverts

### TEMIS Formation (`scraper/sites/temis.py`)

Sécurité/prévention, 16 villes. Site IONOS sans API : parsing des pages
d'antennes (tableaux mois → plages de jours). Particularités :

- L'année n'est pas affichée : elle est déduite (mois passé ⇒ année suivante).
- Le nom de la formation vient du lien « Programme », sinon du texte précédant
  le tableau. ~6 % des sessions restent « Formation non identifiée » : leur
  titre n'existe que dans une image (vérifiable via `source_url`).
- Le tarif est conservé tel qu'affiché (texte).

### PILOCAP (`scraper/sites/pilocap.py`)

CACES, habilitations électriques, travail en hauteur… 12 centres avec
planning en ligne (Angoulême n'en publie pas). Site WordPress : le planning
est un tableau HTML rendu côté serveur (plugin « sji »), très propre —
dates en `data-order` AAAAMMJJ, durée, catégorie, disponibilité.
Particularités :

- Pas de tarif dans le planning public (`tarif` à NULL).
- Les sessions « entrée/sortie permanente » ont des dates NULL et la
  cadence d'ouverture dans `remarque`.
- La `disponibilite` (« Places disponibles », « Dernières places
  disponibles »…) est rafraîchie à chaque scrape.

### CEPIM (`scraper/sites/cepim.py`)

Santé/sécurité au travail, ~15 lieux (Grand Ouest + Île-de-France). La page
`/planning/` embarque **toutes les sessions en JSON** dans son moteur de
recherche client (`window.wpulivesearch_datas`) : une seule requête HTTP
suffit. Chaque entrée fournit le lieu, l'intitulé précis (variante
Initiale/Recyclage), la famille (= `type_formation`), la période, le tarif
(« À partir de : … € ») et le lien vers la fiche (`url_programme`).

- Dates en toutes lettres (« Du 28 au 31 Juil 2026 », « 05 Août 2026 »,
  « Du 28 Août au 01 Sep 2026 ») : parseur de mois français abrégés, avec
  gestion du changement de mois/d'année.
- Le site publie aussi un planning PDF, non utilisé : le JSON est plus
  riche et couvre plus de lieux (le PDF ajoute seulement les sessions
  SSIAP du partenaire SI.GROUPE).

### Groupe ACN (`scraper/sites/acn.py`)

Prévention/sécurité, sessions inter-entreprises surtout en Île-de-France.
Le sitemap liste ~280 fiches formation (`...-i<N>.html`) ; chaque fiche
peut porter un tableau « Calendrier de formation » (début, fin, lieu, en
jj/mm/aaaa). Le scraper parcourt toutes les fiches — c'est le passage le
plus long (~300 requêtes, ~4 min avec 0,5 s de politesse).

- La catégorie (`type_formation`) est reconstituée en croisant les pages
  de catégories (`formation-*.html`) avec leurs listes de fiches.
- `tarif` = affichage fiche (souvent « … € HT / jour / groupe » : tarif de
  groupe, pas par personne). Durée affichée en heures reprise dans
  `remarque` ; `duree_jours` est calculée depuis les dates.
- Les fiches sans calendrier (e-learning, intra pur) ne produisent rien.
- Les libellés de lieux du site sont incohérents (accents/casse/caractères
  parasites) : ils sont normalisés sans accents. « Classe Virtuelle -
  Visioconference » est une pseudo-ville = sessions à distance.

### VoltWork (`scraper/sites/voltwork.py`)

Habilitations électriques. Les seules dates **maintenues** du site sont les
grilles « vw-planning » (formations × plages de dates jj/mm/aa) présentes
sur certaines pages de centres. Le scraper balaie les deux sitemaps
(~200 pages fr) et ne retient que ces grilles.

- **Déduplication par signature** : les ~155 pages SEO par ville reprennent
  la grille du centre le plus proche (Vitrolles = Aix = Marseille…) ; une
  seule ville est retenue par grille, la page hub étant canonique.
- Les fiches formation et pages IRVE affichent aussi des tableaux de dates,
  mais **périmés** (jamais mis à jour) : ignorés volontairement pour ne pas
  polluer la base.
- Tarif : associé depuis le tableau de prix de la page quand la
  correspondance est sans ambiguïté (sinon NULL plutôt qu'un tarif faux —
  cas des lignes « Initiale & Recyclage » à deux prix).
- Passage ~3 min (sitemaps complets à 0,5 s/page).
