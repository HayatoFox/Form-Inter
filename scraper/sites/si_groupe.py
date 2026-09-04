"""Scraper SI Groupe (si-groupe.com) — stdlib uniquement.

Sécurité incendie et sécurité privée (SSIAP, TFP APS, SST, habilitations
électriques…), cinq centres. Même plugin WordPress « wpulivesearch » que
CEPIM : la page /planning/ construit ses cartes en JavaScript, mais la
totalité du calendrier voyage déjà dans le HTML brut, en littéral JSON —

    window.wpulivesearch_datas_keys = ["html", "location", "formation_id",
                                       "formation_family", "name"];
    window.wpulivesearch_datas = [["<div class=\"loop loop-sessions…\"…",
                                   "SI-GROUPE PARIS", "1234", [10],
                                   "MAC SST - …"], …];

Le fragment « html » porte la période (« 04 Sep 2026 », « Du 07 au 21 Sep
2026 », « Du 07 Sep au 09 Oct 2026 », « Du 30 Nov 2026 au 18 Jan 2027 »),
la famille de formation et le lien vers la fiche ; le champ « name »
distingue les variantes que le titre <h3> confond (« MAC APS … avec SST »
et « … sans SST » partagent le même titre).

Une seule requête suffit : le filtrage par centre/famille et le bouton
« Afficher plus » travaillent côté client sur ce tableau déjà chargé — pas
de pagination serveur, pas de formulaire à rejouer, et l'API REST du site
répond 401. Il n'y a donc aucune seconde page à espacer d'un délai de
politesse (même situation que cepim.py).

Ce que le site ne publie nulle part, et qui reste donc à NULL : le tarif
(aucun « € », les fiches renvoient vers un devis), la disponibilité (un
unique bouton « Pré-réserver », identique partout) et la durée pédagogique
— voir ETENDUE_MAX_JOURS_CONSECUTIFS pour le compromis retenu.
"""

import html as html_lib
import json
import re
import unicodedata
import urllib.request
from datetime import date
from urllib.parse import urljoin

ORGANISME = "SI Groupe"
PLANNING_URL = "https://www.si-groupe.com/planning/"
USER_AGENT = "ScrapFormationInterne/1.0 (veille catalogue formations)"

# Le planning ne donne que le nom commercial du centre : la ville réelle est
# lue sur https://www.si-groupe.com/nos-centres-de-formations/, qui publie les
# adresses complètes. Cinq valeurs closes, recopiées et non déduites — le cas
# le moins évident (« SECURITE INCENDIE.IDF ») est confirmé par l'entrée de
# menu « Statistiques SI.Groupe Évry (SI.IDF) ».
CENTRES = {
    "SECURITEINCENDIEIDF": "Évry-Courcouronnes",   # 6 rue du Bois Sauvage, 91000
    "SIGROUPEPARIS": "Paris 14e",                  # 16/24 rue Cabanis, 75014
    "SIGROUPERENNES": "Saint-Grégoire",            # 11 rue des îles Kerguelen, 35760
    "SIGROUPEFACSSTRASBOURG": "Strasbourg",        # 3 rue Charles Péguy, 67200
    "SIGROUPEFACSMULHOUSE": "Mulhouse",            # 20 rue de Chemnitz, 68200
}

# Au-delà d'une semaine calendaire, l'étendue affichée cesse d'être une mesure
# de la durée : elle recouvre aussi bien un SSIAP 1 continu de deux semaines
# qu'un SSIAP 3 « Du 07 Sep au 02 Déc 2026 » — 87 jours calendaires pour une
# poignée de semaines de cours. Le site ne publiant pas la durée pédagogique et
# ne disant pas laquelle des deux formes il affiche, on laisse duree_jours à
# NULL et on se borne à consigner l'étendue lue, sans la qualifier.
ETENDUE_MAX_JOURS_CONSECUTIFS = 7

MOIS_FR = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
           "aout", "septembre", "octobre", "novembre", "decembre"]

# Le tableau des sessions occupe à lui seul son bloc <script>, terminé par
# « ];</script> » : la borne de fin est non ambiguë parce que les fragments
# HTML transportés dans le JSON échappent leurs balises fermantes (« <\/div> »,
# « <\/script> »), sans quoi le navigateur couperait le script en plein milieu.
# Les clés, elles, partagent leur bloc avec la configuration des filtres, d'où
# une capture limitée au premier crochet fermant (tableau plat de chaînes).
_RE_DATAS = re.compile(r"window\.wpulivesearch_datas\s*=\s*(\[.*?\])\s*;?\s*</script>", re.S)
_RE_KEYS = re.compile(r"window\.wpulivesearch_datas_keys\s*=\s*(\[[^\]]*\])")

_RE_PERIODE = re.compile(r'wputh-time-period">([^<]+)<')
_RE_FAMILLE = re.compile(r'c-muted">([^<]+)<')
# Le thème écrit aujourd'hui des liens relatifs ; on accepte aussi la forme
# absolue pour qu'un simple réglage de permaliens ne vide pas d'un coup toute
# la colonne url_programme. urljoin() sait déjà traiter les deux.
_RE_FICHE = re.compile(r'href="((?:https?://[^"/]*)?/formations/[^"]+)"')

_RE_JOUR_UNIQUE = re.compile(r"^(\d{1,2}) (\S+) (\d{4})$")
_RE_MEME_MOIS = re.compile(r"^Du (\d{1,2}) au (\d{1,2}) (\S+) (\d{4})$")
_RE_DEUX_MOIS = re.compile(r"^Du (\d{1,2}) (\S+) au (\d{1,2}) (\S+) (\d{4})$")
_RE_DEUX_ANNEES = re.compile(r"^Du (\d{1,2}) (\S+) (\d{4}) au (\d{1,2}) (\S+) (\d{4})$")


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _sans_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def _propre(valeur) -> str:
    """Décode les entités, remplace les espaces insécables et normalise les
    blancs : le CMS double parfois l'espace dans ses intitulés (« Habilitation
    H0B0  BS/BE Manœuvre »), et deux libellés qui ne diffèrent que par là
    créeraient deux sessions distinctes en base.

    Une valeur non textuelle rend la chaîne vide plutôt que de lever : les
    cinq cents sessions arrivent dans un seul tableau JSON, et une colonne
    manquante sur une ligne ne doit pas coûter toutes les autres.
    """
    if not isinstance(valeur, str):
        return ""
    return re.sub(r"\s+", " ", html_lib.unescape(valeur).replace(" ", " ")).strip()


def _mois_num(token: str) -> int | None:
    """« Sep », « Juil », « Août », « Déc. » -> numéro de mois.
    Correspondance par préfixe (unique) sur les noms complets sans accents."""
    t = _sans_accents(token).lower().strip(". ")
    if not t:
        return None
    candidats = [i + 1 for i, m in enumerate(MOIS_FR) if m.startswith(t)]
    return candidats[0] if len(candidats) == 1 else None


def _jour(annee: int, mois: int | None, quantieme: str) -> date | None:
    """Une date impossible (mois illisible, « 31 Sep » saisi à la main) vaut
    None : la session sera écartée et comptée, jamais décalée en silence."""
    if mois is None:
        return None
    try:
        return date(annee, mois, int(quantieme))
    except ValueError:
        return None


def _parse_periode(texte: str) -> tuple[date, date] | None:
    """Les quatre formes affichées par le site, de la plus explicite à la
    plus elliptique. Quand l'année n'est écrite qu'une fois, elle porte sur
    la FIN de la période : « Du 28 Déc au 02 Jan 2027 » commence en 2026."""
    texte = _propre(texte)

    m = _RE_JOUR_UNIQUE.match(texte)
    if m:
        jour = _jour(int(m.group(3)), _mois_num(m.group(2)), m.group(1))
        return (jour, jour) if jour else None

    m = _RE_MEME_MOIS.match(texte)
    if m:
        annee, mois = int(m.group(4)), _mois_num(m.group(3))
        debut = _jour(annee, mois, m.group(1))
        fin = _jour(annee, mois, m.group(2))
        return (debut, fin) if debut and fin else None

    m = _RE_DEUX_ANNEES.match(texte)
    if m:
        debut = _jour(int(m.group(3)), _mois_num(m.group(2)), m.group(1))
        fin = _jour(int(m.group(6)), _mois_num(m.group(5)), m.group(4))
        return (debut, fin) if debut and fin else None

    m = _RE_DEUX_MOIS.match(texte)
    if m:
        mois_d, mois_f, annee_f = _mois_num(m.group(2)), _mois_num(m.group(4)), int(m.group(5))
        if mois_d is None or mois_f is None:
            return None
        annee_d = annee_f - 1 if mois_d > mois_f else annee_f
        debut = _jour(annee_d, mois_d, m.group(1))
        fin = _jour(annee_f, mois_f, m.group(3))
        return (debut, fin) if debut and fin else None

    return None


def _cle_centre(libelle: str) -> str:
    """Clé de correspondance insensible à la casse et à la ponctuation : le
    site écrit tantôt « SI.GROUPE RENNES », tantôt « SI.Groupe FACS Mulhouse »."""
    return re.sub(r"[^A-Z0-9]", "", _sans_accents(libelle).upper())


def _extraire_datas(page_html: str) -> tuple[list, list]:
    """Le tableau des sessions et la liste de ses colonnes, tels que le plugin
    les dépose dans la page. Toute anomalie lève : mieux vaut un passage en
    erreur, visible dans le back office, qu'un catalogue vidé sans bruit."""
    m_datas = _RE_DATAS.search(page_html)
    m_cles = _RE_KEYS.search(page_html)
    if not m_datas or not m_cles:
        raise RuntimeError("window.wpulivesearch_datas introuvable sur /planning/ : "
                           "la structure du site a changé ?")
    try:
        datas = json.loads(m_datas.group(1))
        cles = json.loads(m_cles.group(1))
    except json.JSONDecodeError as err:
        # Le découpage serait pris en défaut si un fragment cessait un jour
        # d'échapper ses balises, ou si le plugin passait au littéral JS
        # (clés sans guillemets) : on nomme la cause plutôt que de laisser
        # remonter une trace de décodeur. Les deux motifs bornant leur capture
        # aux crochets, ce qui en sort est nécessairement une liste.
        raise RuntimeError("Tableau wpulivesearch illisible sur /planning/ "
                           f"(découpage pris en défaut ?) : {err}") from err
    return datas, cles


def scrape() -> list[dict]:
    """Point d'entrée : retourne toutes les sessions du planning SI Groupe."""
    datas, cles = _extraire_datas(_fetch(PLANNING_URL))
    idx = {cle: i for i, cle in enumerate(cles)}
    if not {"html", "location", "name"} <= set(idx):
        raise RuntimeError(f"Clés wpulivesearch inattendues : {cles}")
    largeur_min = max(idx["html"], idx["location"], idx["name"]) + 1

    sessions = []
    rejets = 0  # lignes illisibles, comptées pour le garde-fou de fin
    for ligne in datas:
        # Une ligne tronquée, ou un objet là où le plugin écrivait un tableau,
        # lèverait sur l'accès par indice et emporterait les cinq cents autres.
        if not isinstance(ligne, list) or len(ligne) < largeur_min:
            rejets += 1
            continue
        fragment = ligne[idx["html"]]
        if not isinstance(fragment, str):
            rejets += 1
            continue

        m_periode = _RE_PERIODE.search(fragment)
        periode = _parse_periode(m_periode.group(1)) if m_periode else None
        if periode is None:
            rejets += 1
            continue
        debut, fin = periode

        # « formation » est NOT NULL en base, et un intitulé vide ne dirait rien
        # à personne dans le calendrier : la ligne est écartée, pas insérée à
        # blanc.
        formation = _propre(ligne[idx["name"]])
        if not formation:
            rejets += 1
            continue

        remarques = []

        libelle_centre = _propre(ligne[idx["location"]])
        ville = CENTRES.get(_cle_centre(libelle_centre))
        if ville is None and libelle_centre:
            # Nouveau centre (Beauvais, Villeneuve-Loubet, Mareuil-lès-Meaux
            # sont annoncés mais n'ont pas encore de sessions) : mieux vaut le
            # libellé commercial brut qu'une session perdue, et la remarque
            # signale la table CENTRES à compléter.
            ville = libelle_centre.title() if libelle_centre.isupper() else libelle_centre
            remarques.append(f"centre « {libelle_centre} » absent de la table des villes")
        elif ville is None:
            # Colonne « location » vide : on laisse NULL plutôt qu'une chaîne
            # vide, qui passerait pour une ville dans les filtres de la webapp.
            remarques.append("centre non précisé par le site")

        etendue = (fin - debut).days + 1
        if 1 <= etendue <= ETENDUE_MAX_JOURS_CONSECUTIFS:
            duree_jours = etendue
        else:
            duree_jours = None  # cas des dates incohérentes traité par main.assainir()
            if etendue > ETENDUE_MAX_JOURS_CONSECUTIFS:
                remarques.append(f"période affichée sur {etendue} jours calendaires ; "
                                 "durée pédagogique non publiée par le site")

        m_famille = _RE_FAMILLE.search(fragment)
        m_fiche = _RE_FICHE.search(fragment)
        # None plutôt que la chaîne vide quand la famille manque ou se réduit à
        # des blancs : c'est une donnée absente, et tout le pipeline teste None.
        type_formation = (_propre(m_famille.group(1)) if m_famille else "") or None

        sessions.append({
            "organisme": ORGANISME,
            "formation": formation,
            "type_formation": type_formation,
            "ville": ville,
            "date_debut": debut.isoformat(),
            "date_fin": fin.isoformat(),
            "duree_jours": duree_jours,
            "tarif": None,       # aucun prix publié : le site renvoie vers un devis
            "remarque": " ; ".join(remarques) or None,
            "disponibilite": None,  # aucun compteur de places, seulement « Pré-réserver »
            "url_programme": urljoin(PLANNING_URL, html_lib.unescape(m_fiche.group(1)))
                             if m_fiche else None,
            "source_url": PLANNING_URL,
        })

    if not sessions:
        raise RuntimeError("Aucune session extraite du planning SI Groupe : "
                           "mise en page modifiée ?")
    # Une récolte amputée est plus dangereuse qu'une erreur : le back office
    # afficherait « OK » sur un scraper à moitié aveugle, et la webapp ferait
    # disparaître les sessions manquantes comme si elles étaient déprogrammées.
    # Tant que la majorité des lignes se lit, on garde la récolte ; au-delà,
    # c'est la mise en page qui a bougé, et le passage doit échouer bruyamment.
    if rejets > len(sessions):
        raise RuntimeError(f"{rejets} lignes illisibles sur {rejets + len(sessions)} "
                           "dans le planning SI Groupe : mise en page modifiée ?")
    return sessions
