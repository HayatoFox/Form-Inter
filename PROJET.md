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
                                              │  API JSON  /api/*    │
                                              │  + fichiers du front │
                                              └─────────┬────────────┘
                                                        │ fetch (cookie + CSRF)
                                              ┌─────────▼────────────┐
                                              │ frontend/  (React)   │
                                              │  build → webapp/     │
                                              │  static/app/ (commité)│
                                              └──────────────────────┘
```

**Côté serveur : 100 % stdlib Python** (urllib, re, json, sqlite3, http.server,
hashlib, fcntl…). Pas de pip, pas de framework. Origine de la contrainte : la
machine de dev n'a ni pip ni venv ; c'est resté un choix assumé (déploiement
trivial, zéro dette de dépendances côté exécution). Si un futur site impose un
vrai besoin (ex. rendu JS → playwright), la voie validée est : paquet apt dans
l'image Docker + wheel PyPI décompressé dans `vendor/` pour le dev local
(mécanique déjà éprouvée avec PyMuPDF, retirée depuis).

**Côté interface : React + TypeScript + Vite + Tailwind** (`frontend/`). Le
rendu HTML serveur d'origine (fonctions Python + `string.Template`) a été
remplacé le 28/07/2026 : l'outil était fonctionnel mais trop brut pour un usage
quotidien. Deux garde-fous ont été posés pour ne pas alourdir l'exploitation :

- **Le build est commité** dans `webapp/static/app/`. Le serveur Python sert ce
  dossier tel quel : `python3 -m webapp` et `docker compose up --build`
  fonctionnent sans Node ni accès au registre npm, comme avant. Node n'est
  requis que pour *modifier* le front.
- **Contrepartie à connaître** : un build oublié laisse l'interface en retard
  sur le code. Après toute modification de `frontend/`, lancer
  `npm --prefix frontend run build` et commiter le résultat. Le `Dockerfile`
  échoue explicitement si `webapp/static/app/index.html` manque.

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

**Index à ne pas perdre** : `idx_sessions_organisme_last_seen`
`(organisme, last_seen)`. Toutes les lectures filtrent sur « l'offre courante »
(`last_seen = MAX(last_seen)` de l'organisme) ; sans cet index ce MAX corrélé
rebalayait la table pour chaque ligne — les statistiques mettaient ~1,8 s,
contre ~0,02 s avec (mesuré sur 2 000 sessions, l'écart croît avec le volume).

**Vues SQL** : `_synchroniser_vues()` ne recrée une vue que si sa définition a
changé. Le DROP + CREATE systématique à chaque connexion faisait courir deux
threads de la webapp l'un contre l'autre (« view already exists ») dès que le
navigateur lançait plusieurs requêtes de front, et prenait un verrou d'écriture
en concurrence avec les ~10 minutes d'écriture du scraper.

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
- **`vues`** — combinaisons de filtres mémorisées par un utilisateur, stockées
  sous forme de query string (`f=1&domaine=…`). `partagee = 1` les propose à
  toute l'équipe ; seul l'auteur peut supprimer les siennes.

La base est régénérable : `rm data/formations.db` + un scrape la reconstruit
(mais perd l'historique first/last_seen, les runs… et les utilisateurs +
overrides — **sauvegarder avant**, cf. `data/backups/`).

## 6. Le serveur web (`webapp/`)

Serveur `ThreadingHTTPServer` + routeur regex maison (`app.py`), une connexion
SQLite par requête. Deux familles de routes : `/api/*` (JSON, `api.py`) et tout
le reste (fichiers du build, `statiques.py`, avec repli sur `index.html` pour
que `/admin/stats` réponde 200 au rechargement).

- **Tout est sous connexion** (sauf `/api/moi`, `/api/connexion` et les
  fichiers statiques). Rôle admin pour `/api/admin/*`. Premier compte créé au
  démarrage si la table est vide (`WEBAPP_ADMIN_USER`/`WEBAPP_ADMIN_PASSWORD`,
  mot de passe généré et affiché en console sinon). **SSO prévu à terme : tout
  est dans `webapp/auth.py`**, rien à toucher ailleurs.
- `filtres.py` reste la source unique de vérité des filtres : validation,
  WHERE paramétré, whitelist de tri, sérialisation en query string. Les filtres
  de l'interface transitent sous cette forme (`?f=1&domaine=…`), donc **une
  vue enregistrée repasse par le même parser qu'un paramètre d'URL** — rien
  d'issu du client n'entre en SQL.
- Défauts d'affichage : offre courante, sessions à venir + permanentes, non
  masquées, tri par date. Exports CSV (`;`, utf-8-sig, anti-injection de
  formule) et XLSX (générateur OOXML stdlib maison, `exports.py`) sur le
  résultat filtré exact.
- **Scrape manuel** : `scrape_ctl.py`, verrou `data/.scrape.lock` en flock
  partagé avec `run_scraper.sh` (le cron s'efface si le manuel tourne et
  inversement). L'état local du processus est suivi par variable module
  (`_debut_local`) — ne pas re-sonder flock depuis le processus détenteur.
- Sécurité : SQL paramétré partout, liens externes seulement si http(s),
  cookies signés HMAC `HttpOnly`+`SameSite=Lax` (secret persisté dans
  `data/.secret`, chmod 600), **jeton CSRF exigé sur POST/PUT/DELETE via
  l'en-tête `X-CSRF-Token`**, CSP stricte (`script-src 'self'` + empreinte
  sha256 du seul script inline, calculée au démarrage depuis `index.html`),
  mots de passe jamais dans les URLs ni relisibles après affichage.

## 6 bis. L'interface (`frontend/`)

React 18 + TypeScript + Vite + Tailwind 4. Code et commentaires en français,
comme le reste du dépôt. Build → `webapp/static/app/` (commité), ~100 ko gzip.

- `lib/filtres.ts` est le miroir de `webapp/filtres.py` : mêmes clés, mêmes
  omissions par défaut. **L'URL est la source de vérité des filtres** (lien
  partageable, bouton Retour fonctionnel).
- `styles.css` porte le design system : palette de marque (bleu `#0072b1`,
  accent orange `#ff6900`), jetons sémantiques (`--surface`, `--bordure`,
  `--texte`…) déclinés en thème clair et sombre, exposés comme utilitaires
  Tailwind (`bg-surface`, `text-doux`…). **Aucun composant n'utilise de
  couleur brute** : c'est ce qui rend la bascule de thème gratuite.
- Composants transverses dans `composants/ui/`, pages dans `pages/`, tout ce
  qui touche à la liste dans `sessions/`.
- Vues enregistrées : table `vues` (personnelle ou partagée), la query string
  des filtres est stockée telle quelle et revalidée à l'écriture.
- Le tableau est en `table-fixed` : la colonne « Formation » absorbe la place
  restante et les cellules clippent (`overflow-hidden`), sinon le contenu
  débordait sur la colonne voisine.

## 7. Docker & déploiement

Une seule image (`ubuntu:24.04` + python3 + cron + ca-certificates + tzdata),
**toujours sans Node** (le front est copié déjà construit), deux services dans
`docker-compose.yml` :

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
# Lancer le site en local (dev) — sert le build commité, pas besoin de Node
WEBAPP_ADMIN_PASSWORD=xxxx python3 -m webapp --port 8010

# Retoucher l'interface (Node requis uniquement pour ça)
npm --prefix frontend install
npm --prefix frontend run build      # régénère webapp/static/app/ — À COMMITER
npm --prefix frontend run dev        # rechargement à chaud, /api relayé vers 8010

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
- **Build du front commité** : à régénérer et commiter après chaque
  modification de `frontend/`, sous peine de servir une interface en retard sur
  le code. Alternative si ça devient pénible : étage Node dans le `Dockerfile`
  (au prix d'un accès au registre npm au moment du build de l'image).
- Le front n'a pas de tests automatisés ; la vérification s'est faite au
  navigateur (parcours complet, thèmes clair et sombre, mobile).
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
- **28/07/2026 (soir)** — Refonte de l'interface. L'outil marchait mais restait
  une page brute peu tenable au quotidien. Décision : garder le serveur Python
  stdlib (propre, éprouvé) et le passer en **API JSON**, remonter l'interface en
  **React/Vite/Tailwind** avec un vrai design system (thème clair/sombre,
  responsive). Le rendu HTML serveur (`rendu.py`, `vues_public.py`,
  `vues_admin.py`, `static/style.css`) est supprimé. Ajouts fonctionnels :
  fiche détail latérale (avec les autres dates de la même formation), vues
  enregistrées personnelles ou partagées (table `vues`), recherche instantanée,
  pastilles de filtres actifs. Deux bugs corrigés au passage, tous deux révélés
  par les requêtes concurrentes de l'interface : la recréation systématique des
  vues SQL (course entre threads) et l'absence d'index sur
  `(organisme, last_seen)` (~100× sur les temps de réponse).
