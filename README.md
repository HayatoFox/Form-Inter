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

Image basée sur Ubuntu 24.04 (noble), cron intégré, aucune dépendance Python.

```bash
docker compose up -d --build
```

Deux services sur la même image : `scraper` (cron quotidien 6 h, modifiable
via `CRON_SCHEDULE` ; `SCRAPE_AT_STARTUP: "0"` désactive le passage initial)
et `webapp` (site interne sur le port 8000 — définir
`WEBAPP_ADMIN_USER`/`WEBAPP_ADMIN_PASSWORD` avant le premier lancement).
La BDD et les logs sont montés depuis l'hôte (`./data`, `./logs`).
Attention : `./data` ne doit jamais être sur NFS/CIFS (verrous SQLite).
Les passages sont visibles via `docker logs scrap-formations`.

Passage unique sans le service :

```bash
docker compose run --rm scraper scrape
```

Le scrape s'exécute sous l'utilisateur `ubuntu` (uid 1000) du conteneur :
les fichiers créés dans `./data` restent donc à l'utilisateur hôte.

## Cron (sans Docker)

`run_scraper.sh` est le point d'entrée prévu pour cron (journalise dans
`logs/scrape_AAAA-MM.log`). Exemple pour un passage quotidien à 6 h :

```
0 6 * * * "/home/rlancel/Documents/GitHub/Scrap site/run_scraper.sh"
```

(à ajouter via `crontab -e`)

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
