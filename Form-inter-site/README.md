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
npm run dev                 # migrations, amorçage, puis http://localhost:3000
```

Aucun `.env` à préparer pour démarrer : l'amorçage le crée depuis
`.env.example` s'il manque, et y écrit une `SESSION_SECRET` tirée au sort.
Sans cette clé, la connexion au back office échouait sur une erreur 500
(« SESSION_SECRET n'est pas défini dans .env ») que le formulaire ne savait pas
expliquer. Une clé déjà présente n'est **jamais** remplacée — la réécrire
déconnecterait tout le monde à chaque démarrage.

`npm run dev` fait donc tout le nécessaire avant de démarrer le serveur : il
applique les migrations, s'assure de la clé de session, amorce la base si elle
est vide, et il **affiche les identifiants du back office** dans le terminal :

```
┌─────────────────────────────────────┐
│ Jeu de démonstration en place.      │
│                                     │
│ Back office : /admin                │
│   identifiant  admin@proinsec.local │
│   mot de passe demo                 │
└─────────────────────────────────────┘
```

L'amorçage est idempotent et ne touche jamais à des données existantes : sur
une base déjà remplie, il **rappelle l'identifiant à chaque démarrage**. Il
l'avait un temps annoncé par un simple « compte existant (1) », sans l'adresse :
qui avait fermé le terminal du premier lancement se retrouvait devant l'écran de
connexion sans savoir quoi taper.

Le mot de passe, lui, n'est pas rappelable : il n'est stocké que haché, et c'est
bien ainsi. À défaut :

```bash
npm run admin:motdepasse                  # en tire un au sort et l'affiche
npm run admin:motdepasse -- secret        # pose celui-là
npm run admin:motdepasse -- secret a@b.fr # sur ce compte-là
```

`ADMIN_EMAIL` et `ADMIN_PASSWORD_SEED` dans `.env` remplacent les valeurs par
défaut au premier amorçage.

Le client Prisma est engendré dans `src/generated/`, **hors dépôt** : un clone
neuf ne l'a pas. Le script `postinstall` s'en charge ; en cas de doute,
`npx prisma generate` le refait.

## Tester en local, sans backend ni Docker

`npm run dev` pose ce jeu tout seul sur une base vide. `npm run db:demo` le
repose à la demande : un catalogue réaliste — organismes, domaines, villes et
intitulés du métier — sans lancer le backend ni attendre une collecte de
quinze minutes.

**Les centres du jeu de démonstration arrivent avec leurs coordonnées.** Le
filtre par distance et la carte marchent donc dès la première seconde, sans
géocoder quoi que ce soit et sans un seul appel à OpenStreetMap. Les
coordonnées des trente-neuf villes sont écrites en dur dans le seed, relevées
une fois.

```bash
cd Form-inter-site
npm install          # engendre le client Prisma au passage
npm run db:demo      # applique les migrations, puis remplit le catalogue
npm run dev          # http://localhost:3000
                     # back office : admin@proinsec.local / demo
```

Pour choisir soi-même le compte, poser `ADMIN_EMAIL` et `ADMIN_PASSWORD_SEED`
dans `.env` avant le seed. L'adresse doit être **valide au sens strict** : le
formulaire de connexion la valide avec `z.string().email()`, qui refuse
`admin@local` faute de point. Le compte existait, le mot de passe était bon, et
la connexion répondait « Email ou mot de passe invalide ».

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
| `NOMINATIM_USER_AGENT`, `NOMINATIM_CONTACT` | Identification exigée par la politique d'usage de Nominatim |
| `NOMINATIM_URL`, `NOMINATIM_PAYS` | Instance de géocodage et pays de restriction |
| `ADRESSE_API_URL` | Service d'autocomplétion d'adresses (défaut : Géoplateforme IGN, qui héberge la BAN) |
| `NEXT_PUBLIC_TUILES_URL`, `NEXT_PUBLIC_TUILES_ATTRIBUTION` | Fond de carte |

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

## Présentation

Tailwind, palette `zinc`, thème sombre porté par les variantes `dark:` dans les
composants. Une direction artistique plus marquée a été tentée puis **annulée à
la demande** ; ce README a décrit un temps des jetons sémantiques et un module
`src/lib/ui.ts` qui n'existent plus. Rien de tel aujourd'hui : ce qu'on lit dans
les composants est ce qui s'affiche.

## OpenStreetMap

Le site géocode des adresses et affiche des cartes. Deux règles gouvernent tout
le dispositif, parce que la politique d'usage de Nominatim est stricte et qu'un
bannissement se mérite vite.

**Un centre est géocodé une fois, puis conservé.** Son adresse ne bouge
pratiquement jamais. Une fois `Centre.latitude/longitude` renseignés, filtrer par
distance ou dessiner une carte ne coûte plus une seule requête sortante. Le
remplissage se déclenche depuis Admin › Sources de données, par lots bornés
(`src/lib/geo/centres.ts`).

**Toute interrogation passe par le cache.** `src/lib/geo/nominatim.ts` est le
seul point de sortie : il lit d'abord la table `Geocodage`, ne sort qu'en cas
d'absence, cadence à une requête toutes les 1,2 s, plafonne à 400 par heure,
identifie l'application par un User-Agent configurable et ne réessaie jamais
après un 429 ou un 403. Les échecs sont mémorisés eux aussi — réinterroger sans
fin une adresse inconnue est exactement la boucle qui fait bannir.

Trois entrées consomment ce dispositif :

| Écran | Ce qu'il coûte à Nominatim |
|---|---|
| Filtre « autour de » sur `/formations` | 0 (la ville est résolue depuis un centre déjà situé) |
| Carte des centres sur une fiche formation | 1 appel maximum, pour l'adresse du client |
| Accueil `/` — adresse choisie dans les suggestions | **0** : la suggestion porte ses coordonnées |
| Accueil `/` — adresse tapée puis validée sans suggestion | 1 appel maximum |
| Autocomplétion du champ adresse | 0 (autre service, voir ci-dessous) |

### L'accueil : la carte

L'entrée par le lieu, en regard de `/formations` qui est l'entrée par la liste.
C'est la question la plus fréquente — « qu'est-ce qui se donne autour de cette
entreprise ? » — donc elle est en page d'accueil ; `/carte`, où la page a vécu
un temps, y redirige en conservant les paramètres.

On pose l'adresse de l'entreprise, on règle mot-clé, domaine, organisme, dates
et rayon, et **les repères suivent en direct** : chaque repère porte le nombre
de formations qui y correspondent, la colonne de gauche les détaille, et cliquer
l'un ou l'autre relie les deux. La molette zoome sous le curseur ; cliquer un
centre dans la liste amène la carte dessus et ouvre son infobulle.

### L'autocomplétion du champ adresse

Elle sert à écrire une adresse qu'on n'a **jamais** tapée : c'est sa raison
d'être. Deux sources (`src/lib/geo/adresses.ts`) :

1. **ce que le site connaît déjà** — adresses des centres, villes où il y a un
   centre, et adresses déjà cherchées par l'équipe (le cache de géocodage). Ce
   sont les réponses les plus souvent attendues : on retourne chez un client
   plus souvent qu'on ne découvre une adresse ;
2. **la Base Adresse Nationale** pour tout le reste, numéros de rue compris.

Le service d'autocomplétion n'est **pas** Nominatim, et ce n'est pas un choix
de confort : sa politique d'usage interdit explicitement l'autocomplétion sur
l'instance publique — une frappe au clavier ne doit pas produire une requête.
La BAN, elle, est un service public sans clé fait pour cet usage ; on y accède
par la Géoplateforme de l'IGN qui l'héberge (`ADRESSE_API_URL` bascule vers
`api-adresse.data.gouv.fr`, même contrat).

**Chaque suggestion porte ses coordonnées**, quelle que soit la source. Choisir
dans la liste ne déclenche donc aucun géocodage — le point de départ est déjà
là. L'autocomplétion, qu'on croirait coûteuse, est ce qui réduit le plus notre
trafic vers Nominatim : un parcours complet tient en deux requêtes, une pour
les suggestions et une pour la recherche.

Quatre garde-fous, parce qu'un champ de saisie est une machine à faire des
requêtes : frappe retardée de 250 ms, requête en vol annulée par la suivante,
cache mémoire des préfixes déjà demandés (5 min), et rien n'est demandé quand
la liste est fermée — sans ce dernier point, choisir une suggestion réécrivait
le champ et relançait une recherche de suggestions pour une liste invisible.

La comparaison sur nos propres adresses est insensible à la casse ET aux
accents : « cesson sevigne » trouve « Cesson-Sévigné », ce que le `LIKE` de
SQLite ne sait pas faire, parce que les deux chaînes sont repliées en
JavaScript avant comparaison.

Si le service est injoignable, la liste se limite silencieusement à nos propres
adresses : une suggestion absente ne doit pas afficher d'erreur.

Ce direct ne coûte rien dehors — l'adresse part une fois, tout le reste
n'interroge que la base — mais il ne doit pas non plus partir en rafale contre
notre propre serveur. Trois précautions dans `src/components/CarteRecherche.tsx` :
le mot-clé et le rayon sont retardés de 300 ms, toute requête encore en vol est
annulée quand la suivante part, et la carte ne se recadre que si le disque a
changé — sinon elle annulerait le déplacement qu'on vient de faire à la main.

Les filtres eux-mêmes ne sont définis qu'à un seul endroit,
`src/lib/recherche.ts`, partagé par les deux pages : sans cela « les formations
qui correspondent » n'aurait pas la même définition de l'une à l'autre, et il
suffirait d'ajouter un critère d'un côté pour que les deux ne comptent plus
pareil.

Deux limites assumées : les distances sont **à vol d'oiseau** (le serveur public
d'OSRM interdit l'usage en production), et la recherche par mot-clé du catalogue
est **sensible aux accents** — « electrique » ne trouve pas « électrique »,
faute de `unaccent` en SQLite. Le champ adresse, lui, n'a pas ce défaut : ses
suggestions sont comparées en mémoire.

### L'adresse de rue d'un centre

**Elle n'arrive par aucun chemin automatique.** Les scrapers ne relèvent que la
ville : c'est ce que les organismes publient dans leur calendrier. Un centre
importé du backend est donc placé au centre de sa commune, ce qui suffit pour
un rayon de trente kilomètres mais pas pour une convocation.

**Tout le monde peut la corriger, sans compte.** Sur la carte d'accueil, chaque
centre ouvert propose « Préciser / Corriger l'adresse de ce centre » : on la
cherche avec la même aide à la saisie, on la choisit dans la liste, et le repère
se déplace aussitôt. C'est un outil interne — celui qui s'aperçoit au téléphone
que le centre de Rennes est en réalité à Cesson-Sévigné doit pouvoir le réparer
sur-le-champ, pas demander un accès au back office.

Trois contreparties, parce qu'une écriture anonyme sans filet n'est pas tenable
(`src/app/actions/adresse-centre.ts`) :

1. **seule une adresse choisie dans les suggestions est acceptée.** Le service
   en rend les coordonnées ; les exiger garantit que l'adresse existe et
   qu'elle est située. Du texte libre serait invérifiable, et c'est justement ce
   qu'on ne veut pas laisser écrire sans compte — le bouton d'enregistrement
   reste donc inactif tant qu'aucune suggestion n'a été retenue ;
2. **tout est journalisé avec les valeurs d'avant** (`ModificationCentre`).
   Admin › Centres affiche les quinze dernières corrections, leur auteur
   (« public » ou l'adresse de l'administrateur) et un bouton **Rétablir
   l'adresse d'avant** — le rétablissement est lui-même journalisé ;
3. **un plafond de vingt corrections par heure et par adresse IP**, pour qu'un
   script maladroit ne réécrive pas le catalogue en boucle.

Le nom du centre, lui, n'est jamais modifiable par ce chemin.

Le travail de fond se fait dans **Admin › Centres**, un écran qui liste tous les centres —
c'est le centre qui porte l'adresse, pas l'organisme, et un siège social n'est
pas un lieu de formation. Les centres absents de la carte remontent en tête,
puisque ce sont eux qui restent à faire ; un filtre les isole. La fiche d'un
organisme garde la même fiche de centre, pour corriger au passage.

**Le champ adresse y est celui de la carte** — le composant
`src/components/ChampAdresse.tsx`, pas une copie — mais ce qu'on fait de la
suggestion diffère : la carte en tire un point de départ, ici on remplit rue,
code postal et ville, **et on pose le centre sur la carte**. Le service rend les
coordonnées avec chaque proposition, donc choisir dans la liste situe le centre
dès l'enregistrement (`geoStatut` à `ok`), sans attendre le prochain passage de
géocodage — une requête par seconde, soit une minute pour quarante centres.

Quatre points de vigilance, tous tenus :

- **une adresse retouchée à la main après un choix oublie les coordonnées.**
  Elles ne décriraient plus ce qui est écrit, et un point faux qui a l'air juste
  est pire qu'un point manquant : le centre repart en file de géocodage ;
- **saisie entièrement manuelle** (sans passer par la liste) : comportement
  d'avant, le centre part en file de géocodage ;
- **le nom d'un centre rapatrié du backend n'est pas modifiable.** La
  synchronisation le retrouve *par son nom* ; le renommer ici aurait fait créer
  un doublon au passage suivant, avec les sessions réparties entre les deux. Elle
  ne crée que les centres manquants et ne réécrit jamais une adresse saisie ici ;
- **les coordonnées ne sont effacées que si la VILLE change.** Corriger une rue
  dans la même commune laisse l'ancien point à quelques centaines de mètres, ce
  qui vaut mieux qu'un centre disparu de la carte le temps du prochain passage.
  C'est pourquoi la carte retient les centres qui *ont des coordonnées*, et non
  ceux dont le statut vaut `ok`.

## Performance

Le site paraissait lent. Les mesures ont désigné deux causes, et écarté celles
qu'on soupçonnait d'abord — ni le volume (2 976 sessions, une base de 2,4 Mo),
ni le rendu serveur (déjà sous 100 ms).

**1. SQLite tournait dans sa configuration par défaut**, `journal_mode=delete`
et `synchronous=FULL` : toute écriture prend un verrou EXCLUSIF qui bloque les
lecteurs. Comme la synchronisation avec le backend écrit des milliers de lignes
et qu'elle part à la visite d'une page, le site se figeait pendant qu'elle
tournait. `src/lib/sqlite-reglages.ts` pose maintenant WAL et ses compagnons à
l'ouverture de la connexion.

| Mise à jour de 2 976 sessions | |
|---|---|
| avant (`delete` / `FULL`) | 3 933 ms, lecteurs bloqués |
| après (WAL / `NORMAL`) | **625 ms**, lecteurs libres |

Le module VÉRIFIE que WAL a bien été retenu et le dit dans le journal sinon :
il réclame de la mémoire partagée, que certains montages ne fournissent pas
(volume lié Docker sur macOS ou Windows, partage réseau). Dans ce cas, mettre
la base sur un volume Docker nommé.

**2. `/formations` envoyait 451 Ko de HTML pour vingt cartes.** La carte est un
composant client : tout ce que la requête ramène est sérialisé dans la page
pour l'hydratation, et la requête ramenait l'objet entier — chaque session
traînait son centre complet (latitude, geoStatut, geoRequete, geoLibelle…) et
ses propres sourceRef, firstSeen, syncedAt, jamais affichés.
`src/lib/champs-formation.ts` liste les champs réellement lus : **192 Ko**,
soit 57 % de moins.

Deux détails de moindre portée, corrigés au passage : le ménage des sessions
périmées lançait une ÉCRITURE à chaque affichage de page pour un résultat
presque toujours vide (une fois par jour suffit), et les réglages de la liaison
backend étaient relus en base à chaque rendu (ils tiennent en mémoire, et
l'écriture invalide le cache elle-même).

**Ce qui a été mesuré puis écarté** : grouper les mises à jour de la
synchronisation en transactions (625 ms une par une contre 663 ms groupées —
aucun gain une fois la base en WAL, Prisma envoyant de toute façon une
instruction par ligne) ; mettre en cache le corpus de l'autocomplétion (la
route répond déjà en 5 ms) ; mettre à jour les repères de la carte au lieu de
les reconstruire (200 repères au plus, sous le seuil du perceptible, pour un
vrai risque de régression).

**Si le site vous paraît toujours lent, vérifiez que vous n'êtes pas en mode
développement.** Mesuré sur les mêmes pages : `/formations` répond en 33 ms en
production contre 176 à 222 ms en développement, et 1,2 s à la première visite
de chaque route — Turbopack compile à la demande. `npm run dev` est fait pour
écrire du code ; `npm run build && npm start`, ou Docker, pour s'en servir.

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
