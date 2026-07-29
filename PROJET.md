# Form-Inter — Veille des formations inter-entreprises (PROINSEC)

Document de référence du projet : contexte, architecture, fonctionnement,
exploitation et pistes. Le [README](README.md) reste le mode d'emploi court ;
ce fichier est la mémoire longue du projet.

*Dernière mise à jour : 28 juillet 2026.*

---

## 1. Objectif

Collecter automatiquement (cron quotidien) les **sessions de formation
inter-entreprises** publiées par plusieurs organismes concurrents ou
partenaires, les normaliser dans une base SQLite unique, et les exposer à
l'équipe PROINSEC via un **site interne de consultation/tri** avec back
office admin.

Pour chaque session on capture : organisme, intitulé, type (libellé du site
source), **domaine** (classification commune), ville, dates de début/fin,
durée, tarif, remarques, disponibilité, lien vers la fiche programme.

## 2. État actuel

- **5 organismes scrapés**, ~3 900 sessions en base, ~45 villes, horizon
  juillet 2026 → septembre 2027.
- Site web + back office opérationnels (testés en local, parcours complet).
- Docker prêt (2 services sur une image Ubuntu 24.04) — **jamais buildé** :
  la machine de dev n'a pas Docker ; à valider sur la machine cible.
- Cron non installé sur la machine de dev (volontaire) : c'est le conteneur
  qui le porte.

| Organisme | Sessions (28/07/2026) | Villes | Source scrapée |
|---|---|---|---|
| PILOCAP | ~1 900 | 12 | tableaux HTML serveur (plugin « sji ») |
| TEMIS Formation | ~1 250 | 16 | pages d'antennes CMS IONOS |
| CEPIM | ~400 | 15 | JSON embarqué `wpulivesearch` |
| Groupe ACN | ~325 | 4 | tableaux « Calendrier » des fiches |
| VoltWork | ~35–55 | 2 | grilles « vw-planning » |

## 3. Architecture

```
┌───────────────┐   cron 6h / bouton admin   ┌──────────────────────┐
│ scraper/       │ ─────────────────────────► │ data/formations.db   │
│  sites/*.py    │   (verrou .scrape.lock)    │  (SQLite, mode WAL)  │
│  domaines.py   │                            └─────────┬────────────┘
│  main.py       │                                      │ lecture (vue
└───────────────┘                                      │ sessions_effectives)
                                              ┌─────────▼────────────┐
                                              │ webapp/  (port 8000) │
                                              │  site + back office  │
                                              └──────────────────────┘
```

**Philosophie : 100 % stdlib Python** (urllib, re, json, sqlite3, http.server,
hashlib, fcntl…). Pas de pip, pas de framework, pas de build front, pas de
JavaScript. Origine de la contrainte : la machine de dev n'a ni pip ni venv ;
c'est devenu un choix assumé (déploiement trivial, zéro dette de dépendances).
Si un futur site impose un vrai besoin (ex. rendu JS → playwright), la voie
validée est : paquet apt dans l'image Docker + wheel PyPI décompressé dans
`vendor/` pour le dev local (mécanique déjà éprouvée avec PyMuPDF, retirée
depuis).

## 4. La collecte (`scraper/`)

### Contrat d'un scraper

`scraper/sites/<nom>.py` expose `ORGANISME` (str) et `scrape() -> list[dict]`
avec les clés du schéma (hors `first_seen`/`last_seen`/`domaine`, posés par le
pipeline). Enregistrement dans `SCRAPERS` (`scraper/main.py`). Chaque scraper
est isolé : son échec n'empêche pas les autres (erreur historisée, code
retour ≠ 0). Politesse : User-Agent identifiable + 0,5 à 1 s entre requêtes.

`main.assainir()` post-traite tout : calcul du `domaine`
(`scraper/domaines.py`, règles regex ordonnées — l'ordre compte) et garde-fou
dates incohérentes (fin < début = coquille du site source → session ramenée à
1 jour, valeur d'origine consignée dans `remarque`).

### Particularités par organisme (et fragilités connues)

- **TEMIS Formation** (temis-formation.fr, CMS IONOS) : pages d'antennes,
  blocs image-titre + tableau mois/jours + texte tarif. Le nom vient du lien
  « Programme » (mot parfois morcelé par des balises → comparaison sans
  espaces), sinon du texte précédant le tableau. **~6 % de « Formation non
  identifiée »** : titre uniquement en image (OCR envisageable un jour).
  **L'année n'est pas affichée** : déduite (mois passé ⇒ année suivante) — à
  surveiller au passage de janvier.
- **PILOCAP** (formation-pilocap.fr, WordPress) : le plus propre — tableaux
  serveur avec dates en `data-order` AAAAMMJJ, durée, catégorie,
  disponibilité (rafraîchie à chaque scrape). Sessions « entrée/sortie
  permanente » → dates NULL + cadence dans `remarque`. Angoulême ne publie
  pas de planning.
- **CEPIM** (cepim.fr) : tout le catalogue daté est dans
  `window.wpulivesearch_datas` (JSON embarqué de la page /planning/) — une
  seule requête HTTP. Dates en toutes lettres avec mois abrégés, périodes à
  cheval sur deux mois/années gérées. **Leçon retenue** : vérifier les
  données embarquées en JS avant de conclure qu'un site est « PDF only »
  (un scraper PDF géométrique complet a été écrit puis jeté). Le PDF du site
  ajouterait seulement les sessions SSIAP du partenaire SI.GROUPE.
- **Groupe ACN** (groupe-acn.fr) : sitemap → ~280 fiches, tableau
  « Calendrier de formation » par fiche. Catégorie reconstituée via les pages
  de catégories + repli mots-clés. Tarifs **de groupe** (« …€ HT / jour /
  groupe »), pas par personne. Lieux normalisés sans accents (site
  incohérent). « Classe Virtuelle - Visioconference » = pseudo-ville des
  sessions à distance. C'est le passage le plus long (~300 requêtes, 3-5 min).
- **VoltWork** (voltwork.fr) : seules les grilles « vw-planning » sont
  maintenues (les tableaux des fiches et pages IRVE sont périmés → ignorés
  volontairement). ~155 pages SEO par ville dupliquent la grille du centre le
  plus proche → **déduplication par signature de grille**, page hub
  canonique. Tarif associé seulement si non ambigu. Volume faible et
  fluctuant (56 → 34 sessions en un jour) : c'est le site le plus volatil.

## 5. Base de données (`data/formations.db`)

Schéma dans `scraper/db.py` (source unique, migrations par `ALTER TABLE`
à la connexion, PRAGMA `journal_mode=WAL` + `busy_timeout=15000`).

- **`sessions`** — une ligne par session. Clé naturelle d'upsert :
  `(organisme, formation, ville, date_debut, date_fin)` avec comparaison
  NULL-safe (`IS`). `date_debut/date_fin` NULL = entrée/sortie permanente.
  `first_seen`/`last_seen` : sémantique « vu au scrape du … » — une session
  retirée du site source n'est jamais supprimée, son `last_seen` cesse
  d'avancer. **« Offre courante » = `last_seen = MAX(last_seen)` corrélé PAR
  organisme** (un scraper en échec ne fait pas disparaître son organisme).
- **`overrides`** — corrections admin durables (masquer, renommer, reclasser,
  note interne), clé naturelle avec `'' `au lieu de NULL (fiabilité du
  UNIQUE). Appliquées en lecture via la **vue `sessions_effectives`**
  (LEFT JOIN + COALESCE), jamais en modifiant `sessions`. Les ids
  AUTOINCREMENT ne sont jamais persistés côté admin (ils changent si la base
  est régénérée). Overrides « orphelins » (session renommée côté source)
  listés dans le back office.
- **`scrape_runs`** — un enregistrement par organisme et par passage
  (durée, nb sessions, statut, message d'erreur tronqué, déclencheur
  cron/manuel). Alimente la page Santé.
- **`utilisateurs`** — comptes du site (identifiant unique NOCASE, hash
  scrypt `scrypt$salt$hash`, rôle admin, actif).

La base est régénérable : `rm data/formations.db` + un scrape la reconstruit
(mais perd l'historique first/last_seen, les runs… et les utilisateurs +
overrides — **sauvegarder avant**, cf. `data/backups/`).

## 6. Le site web (`webapp/`)

Serveur `ThreadingHTTPServer` + routeur regex maison (`app.py`), une
connexion SQLite par requête, HTML rendu par fonctions Python +
`string.Template` (`rendu.py`), CSS artisanal aux couleurs PROINSEC
(`static/style.css` : bleu `#0072b1`, accent orange `#ff6900`).

- **Tout est sous connexion** (sauf /connexion et /static). Rôle admin pour
  /admin/*. Premier compte créé au démarrage si la table est vide
  (`WEBAPP_ADMIN_USER`/`WEBAPP_ADMIN_PASSWORD`, mot de passe généré et
  affiché en console sinon). **SSO prévu à terme : tout est dans
  `webapp/auth.py`**, rien à toucher ailleurs.
- **Exigence structurante : pas de filtres dynamiques.** Un formulaire GET,
  un bouton « Filtrer », une requête par action. `filtres.py` centralise la
  validation, le WHERE paramétré, la whitelist de tri et la génération
  d'URLs (`url_liste()` — pagination, tris, exports et retours admin passent
  tous par lui).
- Défauts d'affichage : offre courante, sessions à venir + permanentes, non
  masquées, tri par date. Exports CSV (`;`, utf-8-sig, anti-injection de
  formule) et XLSX (générateur OOXML stdlib maison, `exports.py`) sur le
  résultat filtré exact.
- **Scrape manuel** : `scrape_ctl.py`, verrou `data/.scrape.lock` en flock
  partagé avec `run_scraper.sh` (le cron s'efface si le manuel tourne et
  inversement). L'état local du processus est suivi par variable module
  (`_debut_local`) — ne pas re-sonder flock depuis le processus détenteur.
- Sécurité : SQL paramétré partout, `e()` (html.escape) systématique, liens
  externes seulement si http(s), CSRF HMAC sur tous les POST, cookies signés
  HMAC (secret persisté dans `data/.secret`, chmod 600), redirections
  relatives validées, mots de passe jamais dans les URLs.

## 6 bis. Le site de consultation (`Form-inter-site/`)

Second front, Next.js (App Router) + Prisma/SQLite, développé en parallèle du
site stdlib : recherche publique par cartes/modales et back office propre. Il ne
remplace pas `webapp/` — les deux lisent la même veille, `webapp/` restant
l'outil interne complet (exports, santé des scrapers, scrape manuel, overrides).

Il se remplit par **deux sources qui cohabitent** :

- **import Excel/CSV** d'un fichier transmis par un organisme (assistant en
  4 étapes : fichier → mapping des colonnes → aperçu → import) ;
- **liaison dynamique avec ce backend**, en mode `http` (API JSON, §6) ou
  `sqlite` (lecture seule de `data/formations.db` sur le même volume).

Chaque ligne porte sa provenance (`source` = `MANUEL` | `BACKEND`) : la
synchronisation ne touche jamais aux données manuelles, et un import ne modifie
jamais une ligne rapatriée. La clé de rapprochement d'une session est la **clé
naturelle** du backend (`organisme|formation|ville|date_debut|date_fin`), pas
son id AUTOINCREMENT (qui change si la base est régénérée).

Points structurants :

- **Le modèle à plat du backend est éclaté** en Organisme / Centre / Domaine /
  Formation / Session. Les entités sont rapprochées sans casse ni accents
  (« Cepim » saisi à la main = « CEPIM » scrapé).
- **Les sessions à entrée/sortie permanente** (dates NULL) sont reprises telles
  quelles : `Session.dateDebut` est nullable côté site aussi.
- **Dates calendaires à minuit UTC**, affichées en UTC : sans ça une date
  importée à minuit local s'affiche la veille selon le fuseau.
- **Garde-fous de synchronisation** : un lot vide ou une pagination tronquée
  interrompent le passage plutôt que d'amputer le catalogue ; un verrou en base
  (avec expiration) interdit deux passages simultanés.
- **Miroir assumé** : une session du backend absente du lot est retirée du site.
  C'est sans danger parce que l'offre courante est corrélée *par organisme* — un
  scraper en échec continue de publier son relevé de la veille.
- **Déclenchement** : bouton du back office, rafraîchissement automatique à la
  visite quand le dernier passage dépasse la fraîcheur demandée (`after()` de
  Next.js, le visiteur n'attend pas), ou `GET /api/cron/sync` avec
  `CRON_SECRET` depuis un cron système.

## 7. Docker & déploiement

Une seule image (`ubuntu:24.04` + python3 + cron + ca-certificates + tzdata),
deux services dans `docker-compose.yml` :

- **`scraper`** : cron intégré (`CRON_SCHEDULE`, défaut 6 h) + scrape au
  démarrage (`SCRAPE_AT_STARTUP=0` pour désactiver).
- **`webapp`** : `command: ["webapp"]`, port 8000. Définir
  `WEBAPP_ADMIN_USER`/`WEBAPP_ADMIN_PASSWORD` avant le premier lancement.

Volumes partagés `./data` + `./logs` (bind mounts, uid 1000 = utilisateur
`ubuntu` du conteneur). **Jamais `./data` sur NFS/CIFS** (verrous SQLite).
Port 8000 à garder sur le LAN/VPN (pas de HTTPS intégré ; reverse proxy si
exposition plus large). `docker-entrypoint.sh` : modes `cron` / `scrape` /
`webapp`.

## 8. Exploitation courante

```bash
# Lancer le site en local (dev)
WEBAPP_ADMIN_PASSWORD=xxxx python3 -m webapp --port 8010

# Scrape complet manuel (hors Docker)
python3 -m scraper.main --declencheur=manuel

# Interroger la base (pas de CLI sqlite3 sur la machine de dev)
python3 -c "import sqlite3; c=sqlite3.connect('data/formations.db'); ..."

# Sauvegarde cohérente de la base
python3 -c "import sqlite3; s=sqlite3.connect('data/formations.db'); \
d=sqlite3.connect('data/backups/formations_AAAA-MM-JJ.db'); s.backup(d)"
```

Logs : `logs/scrape_AAAA-MM.log` (cron) et `logs/scrape_manuel_AAAA-MM.log`.
Santé au quotidien : page `/admin` (pastilles + alertes chute de volume /
échec / cron muet > 26 h).

## 9. Ajouter un organisme — check-list

1. Explorer le site : chercher dans l'ordre — API/JSON embarqué (scripts,
   `window.*`), sitemap, tableaux HTML serveur, et seulement en dernier
   recours PDF/images. Tester avec curl AVANT d'écrire du code.
2. Écrire `scraper/sites/<nom>.py` (contrat §4), politesse, erreurs
   bruyantes si la structure change (`RuntimeError` explicite plutôt que
   données fausses).
3. L'ajouter à `SCRAPERS`, lancer, contrôler : villes propres, durées ≥ 0,
   domaines classés (compléter `domaines.py` si besoin), doublons.
4. Documenter ses particularités dans le README + ce fichier.

## 10. Dette connue & pistes

- **Build Docker jamais exécuté** (pas de Docker sur la machine de dev) —
  premier `docker compose up --build` sur la cible = test réel.
- TEMIS : ~75 sessions « Formation non identifiée » (titres en image) —
  OCR possible, ou correction manuelle via le back office (renommage).
- TEMIS : bascule d'année implicite à surveiller en janvier.
- VoltWork : volumes faibles et volatils ; alerte de chute réglée à 50 %
  (`config.SEUIL_CHUTE`).
- SSO à brancher dans `webapp/auth.py` quand PROINSEC sera prêt.
- Candidats non traités : sessions SSIAP SI.GROUPE (PDF CEPIM), autres
  organismes à la demande.
- Les scrapers écrivent en séquentiel (~10-12 min au total) ; parallélisable
  si le besoin apparaît, mais le cron quotidien rend ça inutile aujourd'hui.

## 11. Chronologie des décisions

- **28/07/2026** — Création : scrapers TEMIS, PILOCAP, CEPIM (v1 PDF
  PyMuPDF remplacée le jour même par le JSON embarqué — retour au zéro
  dépendance), ACN, VoltWork ; conteneurisation Ubuntu 24.04 ; colonne
  `domaine` ; webapp + back office (comptes, overrides, santé, scrape
  manuel, stats) ; migration du projet depuis « Scrap site » vers ce dépôt
  **Form-Inter** (désormais le dossier de référence).
