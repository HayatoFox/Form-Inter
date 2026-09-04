"""Scraper FORMA-SO (forma-so.com) — stdlib uniquement.

Organisme de formation de Lons (64), près de Pau, avec une antenne à Ustaritz
au Pays basque : CACES, AIPR, habilitations électriques, SST, travail en
hauteur, incendie. SIREN 913 872 305, NAF 85.59B.

POURQUOI CE SCRAPER PASSE PAR UNE API ET NON PAR LES PAGES HTML
---------------------------------------------------------------
Le catalogue public est une application Angular adossée à la plateforme GESCOF
de l'éditeur du site. Deux constats ont décidé de la méthode :

1. LE HTML NE PUBLIE QUE LES TROIS PROCHAINES SESSIONS par fiche. Le nombre
   `nbElements=3` est fixé dans le composant, aucun paramètre d'URL ne pagine,
   et le reste se charge en XHR. Un scraper HTML honnête ramènerait environ
   160 lignes sur les 679 réellement programmées : un quart du catalogue, sans
   que rien ne signale le manque. Pour un site dont l'objet est de dire ce qui
   est disponible et quand, c'est une donnée fausse.
2. LE TEXTE RENDU CÔTÉ SERVEUR DÉCALE LES DATES D'UN JOUR (bug de fuseau du
   rendu). Seul le JSON est juste. Un parseur du HTML visible produirait des
   centaines de dates fausses sans lever la moindre erreur.

Le front interroge donc la même API que ce module, et le module s'y prend
exactement comme le navigateur d'un visiteur : il demande le jeton anonyme que
la plateforme délivre à qui présente l'origine du site, puis lit les sessions
publiées. Rien n'est contourné, aucun compte n'est utilisé, aucune donnée
non publique n'est atteinte — c'est la vue du visiteur, prise en une requête
au lieu de cinquante et une.

C'est aussi, et c'est l'argument qui a emporté la décision, BEAUCOUP PLUS
LÉGER POUR LEUR SERVEUR : trois requêtes d'environ 3 Mo au total, contre
51 pages de 670 Ko (~35 Mo) qu'il faudrait recharger à chaque passage pour un
résultat quatre fois moins complet.

Contrepartie assumée : le contrat de cette API n'est pas documenté et peut
changer sans préavis. Chaque étape lève donc une RuntimeError explicite plutôt
que de rendre une liste vide — un passage qui échoue bruyamment se répare, un
passage qui rend zéro session en silence fait disparaître l'organisme du
catalogue sans que personne ne le voie.

UNE LIGNE PAR OFFRE, PAS PAR JOURNÉE
------------------------------------
L'API rend 679 lignes pour 354 codes de session : une même journée porte
parfois plusieurs fiches produit. Le 28 septembre à Lons, par exemple, une
seule session AIPR couvre les trois profils du référentiel — Concepteur,
Encadrant et Opérateur — qui sont trois formations distinctes, avec leurs
programmes, leurs durées et leurs tarifs propres.

On publie donc une ligne par fiche, et non par journée : quelqu'un qui cherche
« AIPR Encadrant » doit trouver cette date. Les lignes qui partagent une même
journée le disent dans leur remarque. C'est aussi ce qui donne 679 clés
naturelles distinctes pour `db.upsert_sessions`, là où le libellé de stage
seul en aurait fondu 679 en 354.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

ORGANISME = "FORMA-SO"

API = "https://api.gescof.com"
SITE = "https://forma-so.webbiz.gescof.com"
CATALOGUE = f"{SITE}/catalogue-de-formations"

USER_AGENT = "ScrapFormationInterne/1.0 (veille catalogue formations)"
DELAY_BETWEEN_PAGES = 1.0  # secondes, politesse — 3 requêtes par passage
DELAI_RESEAU = 90  # la liste complète des sessions pèse environ 3 Mo

# Les lieux tels que la plateforme les nomme, ramenés à une commune. Les trois
# derniers ne sont pas des centres FORMA-SO mais des salles partenaires : la
# commune reste juste, c'est bien là que la session se donne.
COMMUNES = {
    "FORMA SO - Lons": "Lons",
    "FORMA-SO Ustaritz": "Ustaritz",
    "CAPEB TARBES": "Tarbes",
    "CAPEB LESCAR": "Lescar",
    "ASFO ST PAUL LES DAX": "Saint-Paul-lès-Dax",
}

# Les filtres du catalogue public, recopiés tels que le site les envoie : on
# ne voit donc que ce qu'un visiteur voit — sessions inter-entreprises
# (stageIntra=false), publiées, à l'état prévisionnel ou confirmé, sur des
# fiches actives et publiques, non rattachées à un client particulier.
FILTRES = (
    ("numSession_stageIntra", "false"),
    ("numSession_publicationSession", "false"),
    ("numSession_etat", "1||2"),
    ("numFicheProduit_ficheActive", "true"),
    ("numFicheProduit_publicationMigal", "true"),
    ("numFicheProduit_codeProduit_publicationProduit", "true"),
    ("numFicheProduit_codeProduit_produitActif", "true"),
    ("numFicheProduit_codeProduit_produitFormation", "true"),
    ("numFicheProduit_numClient", "null"),
    ("numFicheProduit_numClientGroupe", "null"),
    ("!numSession_dateDebutSession", "null"),
)


def _lire(url: str, jeton: str | None = None) -> object:
    """Un GET JSON. L'en-tête Origin est celui du site public : la plateforme
    s'en sert pour savoir de quel organisme on parle, comme pour le navigateur
    d'un visiteur."""
    entetes = {
        "Origin": SITE,
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    if jeton:
        entetes["Authorization"] = "Bearer " + jeton
    requete = urllib.request.Request(url, headers=entetes)
    try:
        with urllib.request.urlopen(requete, timeout=DELAI_RESEAU) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as erreur:
        raise RuntimeError(
            f"FORMA-SO : {url.split('?')[0]} a répondu {erreur.code}"
        ) from erreur
    except json.JSONDecodeError as erreur:
        raise RuntimeError(
            f"FORMA-SO : réponse illisible de {url.split('?')[0]}"
        ) from erreur


def _jeton() -> str:
    """Le jeton anonyme que la plateforme délivre au site public."""
    accueil = _lire(f"{API}/anon/api")
    jeton = accueil.get("webbizAuth") if isinstance(accueil, dict) else None
    if not jeton:
        raise RuntimeError(
            "FORMA-SO : pas de jeton anonyme dans /anon/api — l'API a changé"
        )
    return jeton


def _sessions(jeton: str) -> list[dict]:
    """Toutes les sessions à venir, en une requête.

    La borne basse est calculée à chaque passage (jamais de date en dur) ; le
    serveur écarte lui-même ce qui est passé. Le `0/-1` est la pagination de la
    plateforme : première page, sans limite."""
    filtres = list(FILTRES) + [
        ("numSession_dateDebutSession", "sinceFilter;" + date.today().isoformat())
    ]
    url = f"{API}/sessions-fiches-produits/0/-1?" + urllib.parse.urlencode(filtres)
    lignes = _lire(url, jeton)
    if not isinstance(lignes, list):
        raise RuntimeError("FORMA-SO : la liste des sessions n'est pas un tableau")
    if not lignes:
        raise RuntimeError("FORMA-SO : aucune session rendue par l'API")
    return lignes


def _slugs_produits(jeton: str, identifiants: set[int]) -> dict[int, str]:
    """Le fragment d'URL du produit auquel chaque fiche appartient.

    L'adresse publique d'une fiche s'écrit `/formation/<produit>/<fiche>`, et
    seul le second fragment voyage avec les sessions. On demande donc les
    fiches concernées — en UNE requête, la plateforme acceptant une liste de
    valeurs séparées par `||`."""
    if not identifiants:
        return {}
    url = f"{API}/fiches-produits/0/-1?" + urllib.parse.urlencode(
        [("numFicheProduit", "||".join(str(i) for i in sorted(identifiants)))]
    )
    fiches = _lire(url, jeton)
    if not isinstance(fiches, list):
        return {}
    slugs = {}
    for fiche in fiches:
        if not isinstance(fiche, dict):
            continue
        produit = fiche.get("codeProduit")
        if isinstance(produit, dict) and produit.get("titleSeo"):
            slugs[fiche.get("numFicheProduit")] = produit["titleSeo"]
    return slugs


def _texte(valeur: object) -> str | None:
    """Une chaîne utile, ou None. Jamais de chaîne vide : la base distingue
    « pas de valeur » de « valeur vide », et le site s'appuie dessus."""
    if not isinstance(valeur, str):
        return None
    propre = " ".join(valeur.split())
    return propre or None


def _montant(valeur: object) -> str | None:
    """« 150.000000 » devient « 150 € ». Un montant nul veut dire « non
    publié » — 597 lignes sur 679 en portent un, les autres non."""
    try:
        euros = float(valeur)
    except (TypeError, ValueError):
        return None
    if euros <= 0:
        return None
    return f"{euros:.0f} €" if euros == int(euros) else f"{euros:.2f} €"


def _jour(horodatage: object) -> str | None:
    """« 2026-09-28T00:00:00+02:00 » devient « 2026-09-28 ».

    On tronque au lieu de convertir : la plateforme date les sessions à minuit
    dans le fuseau français, et passer par UTC ferait reculer chaque date d'un
    jour — c'est exactement le bug que le rendu HTML du site donne à lire."""
    if not isinstance(horodatage, str) or len(horodatage) < 10:
        return None
    jour = horodatage[:10]
    return jour if jour[4] == "-" and jour[7] == "-" else None


def _duree(*candidats: object) -> float | int | None:
    """Le premier nombre de jours exploitable. Entier quand il tombe juste,
    comme ailleurs dans le dépôt (`1` et non `1.0`)."""
    for valeur in candidats:
        try:
            jours = float(valeur)
        except (TypeError, ValueError):
            continue
        if jours > 0:
            return int(jours) if jours == int(jours) else jours
    return None


def scrape() -> list[dict]:
    jeton = _jeton()
    time.sleep(DELAY_BETWEEN_PAGES)
    lignes = _sessions(jeton)

    identifiants = set()
    for ligne in lignes:
        fiche = ligne.get("numFicheProduit") if isinstance(ligne, dict) else None
        if isinstance(fiche, dict) and isinstance(fiche.get("numFicheProduit"), int):
            identifiants.add(fiche["numFicheProduit"])
    time.sleep(DELAY_BETWEEN_PAGES)
    slugs = _slugs_produits(jeton, identifiants)

    # Combien de fiches partagent chaque journée : sert à la remarque, pour
    # qu'on sache que ces lignes ne sont pas un doublon mais bien plusieurs
    # formations tenues le même jour.
    par_code: dict[str, int] = {}
    for ligne in lignes:
        session = ligne.get("numSession") if isinstance(ligne, dict) else None
        code = session.get("numSession") if isinstance(session, dict) else None
        if code:
            par_code[code] = par_code.get(code, 0) + 1

    sessions: list[dict] = []
    rejets = 0

    for ligne in lignes:
        if not isinstance(ligne, dict):
            rejets += 1
            continue
        session = ligne.get("numSession")
        fiche = ligne.get("numFicheProduit")
        if not isinstance(session, dict) or not isinstance(fiche, dict):
            rejets += 1
            continue

        intitule = _texte(fiche.get("intituleProduit"))
        debut = _jour(session.get("dateDebutSession"))
        if not intitule or not debut:
            # La colonne `formation` est NOT NULL en base, et une session sans
            # date de début y signifierait « entrée/sortie permanente », ce que
            # cette ligne n'est pas. Mieux vaut l'écarter et la compter.
            rejets += 1
            continue

        lieu = _texte(session.get("lieuSession"))
        ville = COMMUNES.get(lieu or "")
        remarques = []
        if not ville and lieu:
            # Un lieu inconnu ne fait pas perdre la session : on recopie le
            # libellé et on signale que la table est à compléter.
            ville = lieu
            remarques.append(f"lieu « {lieu} » absent de la table des communes")

        code = _texte(session.get("numSession"))
        if code and par_code.get(code, 0) > 1:
            autres = par_code[code] - 1
            remarques.append(
                f"session {code}, tenue le même jour que {autres} autre"
                f"{'s' if autres > 1 else ''} formation"
                f"{'s' if autres > 1 else ''}"
            )

        slug_produit = slugs.get(fiche.get("numFicheProduit"))
        slug_fiche = _texte(fiche.get("titleSeo"))
        url_programme = (
            f"{SITE}/formation/{slug_produit}/{slug_fiche}"
            if slug_produit and slug_fiche
            else None
        )

        sessions.append({
            "organisme": ORGANISME,
            "formation": intitule,
            # Le libellé de stage est la famille sous laquelle le site range
            # la journée (« Autorisation d'intervention à proximité des
            # réseaux ») : c'est bien la nomenclature d'origine.
            "type_formation": _texte(session.get("libelleStage")),
            "ville": ville,
            "date_debut": debut,
            "date_fin": _jour(session.get("dateFinSession")) or debut,
            "duree_jours": _duree(ligne.get("nbJours"), session.get("nbJours")),
            "tarif": _montant(ligne.get("tarif")) or _montant(ligne.get("tarifInternet")),
            "remarque": " ; ".join(remarques) or None,
            # « Confirmée » ou « Prévisionnelle » : c'est ce que le site
            # affiche au visiteur, et la seule information de disponibilité
            # qu'il publie (les effectifs restants ne le sont pas).
            "disponibilite": _texte(session.get("etatTexte")),
            "url_programme": url_programme,
            "source_url": CATALOGUE,
        })

    # Une récolte amputée de plus de la moitié n'est pas une récolte : mieux
    # vaut un passage en erreur, que le back office signale, qu'un catalogue
    # silencieusement rogné — la synchronisation ferait disparaître du site les
    # sessions manquantes comme si elles étaient déprogrammées.
    if not sessions:
        raise RuntimeError("FORMA-SO : aucune session exploitable dans la réponse")
    if rejets > len(sessions):
        raise RuntimeError(
            f"FORMA-SO : {rejets} lignes écartées pour {len(sessions)} retenues — "
            "le format de l'API a probablement changé"
        )
    return sessions
