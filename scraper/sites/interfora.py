"""Scraper INTERFORA IFAIP (interfora-ifaip.fr) — stdlib uniquement.

Centre de formation en chimie et procédés de Saint-Fons (69) : FSSEE,
habilitations électriques, ISM-ATEX, port de l'ARI, SST, AIPR, CATEC, travail
en hauteur, espaces confinés.

Le planning est un calendrier du greffon WordPress « Booking Activities »
(FullCalendar). Contrairement aux autres sites du dépôt, la page ne contient
AUCUNE session : elle livre « "events":[] » et « "auto_load":0 », le
calendrier allant chercher ses dates lui-même. Le scraper refait donc ce que
ferait le navigateur, en deux requêtes et sans exécuter de JavaScript :

 1. GET de la page. On y découpe deux littéraux JSON :
    « bookacti.booking_system['…'] = {…} », la configuration du calendrier,
    et « var bookacti_localized = {…} », qui donne l'URL AJAX et
    « booking_system_attributes_keys », la liste blanche des 42 attributs que
    le serveur accepte de relire.
 2. POST de l'action bookactiGetBookingSystemDataByInterval sur
    wp-admin/admin-ajax.php, avec cette configuration filtrée et un
    intervalle large. Ni nonce, ni cookie, ni Referer exigés : la réponse est
    celle que reçoit un visiteur anonyme. robots.txt interdit /wp-admin/ mais
    autorise nommément admin-ajax.php, qui est justement le seul point
    sollicité ici.

La réponse rend les occurrences DÉJÀ dépliées — les récurrences hebdomadaires
et leurs exceptions, dont la fermeture estivale, sont résolues côté serveur —
et le serveur rogne lui-même le passé. Un appel suffit : pas de pagination.

Le découpage des deux littéraux se fait au JSONDecoder et non à l'expression
régulière comme ailleurs dans le dépôt : les accolades imbriquées de ces
objets piègent tout motif non gourmand, alors que raw_decode() s'arrête
exactement à la fin de l'objet qu'il vient de lire.

Ce que le calendrier ne publie pas, et qui reste donc à NULL :

- le TARIF. Les 32 fiches /form/ l'affichent bien (« Prix : 140 € HT »), mais
  aucune clé ne permet de les rattacher aux activités du calendrier sans
  risque de se tromper de prix : 11 fiches seulement portent un lien PDF, et
  ris01a_fssee_n1.pdf est partagé par deux d'entre elles affichées à 140 € et
  à 280 € ; côté titres, trois formations distinctes (B0H0 recyclage, BE
  manœuvre initial, BS recyclage) publient le même « BOHO-HOV personnel non
  électricien exécutant (recyclage) ». Un tarif faux valant moins que pas de
  tarif, on s'abstient — ces fiches restent lisibles par un humain depuis
  url_programme.
- la DISPONIBILITÉ. is_available vaut True pour les 836 sessions sans
  exception, et le nombre de places restantes se compte sur un total
  manifestement conventionnel : 1000 places pour 536 sessions, 10000 pour
  296 autres — « 995 places sur 1000 » serait une donnée fausse. Les quatre
  dernières (les « Plan de prévention ») sont bien plafonnées à 1, mais le
  greffon ne publie aucune réservation pour elles : ce 1 est un réglage de
  formulaire, pas une place restante comptée.
"""

import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date
from urllib.parse import urljoin, urlparse

ORGANISME = "INTERFORA IFAIP"
BASE_URL = "https://www.interfora-ifaip.fr/"
PLANNING_URL = BASE_URL + "accueil-centre-de-formation/les-formations-reglementaires/"
SOURCE_URL = PLANNING_URL + "#Planning"  # l'ancre mène droit au calendrier
USER_AGENT = "ScrapFormationInterne/1.0 (veille catalogue formations)"
DELAY_BETWEEN_PAGES = 1.0  # secondes, politesse

ACTION_AJAX = "bookactiGetBookingSystemDataByInterval"

# Organisme mono-site : le calendrier est celui de la rubrique « FORMATIONS
# DANS NOS LOCAUX », les mentions légales situent le siège au 2 place Georges
# Girardet à Saint-Fons (69), et chaque fiche /form/ répète « Lieu INTERFORA
# IFAIP, 2 place Georges Girardet, 69190 St Fons ». La constante n'est donc pas
# un pis-aller : c'est la seule ville que ce planning décrive.
VILLE = "Saint-Fons"

# Une journée de formation vaut ici 8 h 30 (08:00 – 16:30) et une demi-journée
# 4 h. C'est cette échelle, et non les 24 h d'une journée calendaire, qui
# convertit la durée du greffon en jours de formation.
JOURNEE_PEDAGOGIQUE_H = 8.5

# L'intervalle demandé n'a qu'à être assez large pour couvrir tout ce que le
# site programme devant lui (quinze mois à ce jour) : le serveur rogne le passé
# de lui-même et ne plafonne pas la borne haute. Cinq ans y suffisent, et le
# calcul à partir de la date du jour évite une borne en dur qui se périmerait.
ANNEES_DEMANDEES = 5

# Le suffixe numérique de l'identifiant change à chaque rendu de la page : il
# ne peut pas être écrit en dur. Les deux motifs s'arrêtent au « = », la suite
# étant laissée au JSONDecoder.
_RE_CONFIG = re.compile(r"bookacti\.booking_system\[\s*['\"][^'\"]+['\"]\s*\]\s*=\s*")
_RE_LOCALIZED = re.compile(r"\bbookacti_localized\s*=\s*")

# « JJJ.HH:MM:SS » : l'étendue d'une occurrence, telle que la publie l'activité
_RE_DUREE = re.compile(r"^(\d+)\.(\d{2}):(\d{2}):(\d{2})$")

# activity_message est un fragment HTML : « … <a href="…RIS48-AIPR-concepteur.pdf">
# Lien vers la fiche formation</a> »
_RE_PDF = re.compile(r'href=["\']([^"\']+\.pdf)["\']', re.I)

# Le préfixe du titre est la famille de formation (FSSEE, HE, ATEX, ARI, SST,
# AIPR, CATEC) ; on ne le retient que s'il ressemble à un sigle — un seul mot
# de deux à six capitales — pour ne pas promouvoir « PRÉVENIR LES CHUTES DE
# HAUTEUR » en catégorie. Les quatre intitulés sans sigle restent à NULL.
_RE_FAMILLE = re.compile(r"^([A-Z]{2,6})(?:\s*[-–—]|$)")


def _fetch(url: str, donnees: dict | None = None) -> str:
    """GET, ou POST form-urlencoded si des données sont fournies."""
    corps = urllib.parse.urlencode(donnees).encode("utf-8") if donnees else None
    req = urllib.request.Request(url, data=corps,
                                 headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _objet_json(page_html: str, motif: re.Pattern, libelle: str) -> dict:
    """Lit le littéral JSON qui suit l'affectation repérée par `motif`."""
    m = motif.search(page_html)
    if not m:
        raise RuntimeError(f"{libelle} introuvable sur {PLANNING_URL} : "
                           "le greffon Booking Activities a-t-il changé ?")
    try:
        objet, _ = json.JSONDecoder().raw_decode(page_html, m.end())
    except ValueError as erreur:
        # Le décodeur ne parle que de sa position dans la page ; sans ce
        # rattrapage, le journal du passage ne dirait pas lequel des deux
        # littéraux a cessé d'être lisible.
        raise RuntimeError(f"{libelle} : littéral JSON illisible sur "
                           f"{PLANNING_URL} ({erreur})") from erreur
    if not isinstance(objet, dict):
        raise RuntimeError(f"{libelle} n'est plus un objet JSON mais un "
                           f"{type(objet).__name__} : greffon modifié ?")
    return objet


def _url_ajax(reglages_js: dict) -> str:
    """L'URL du point AJAX telle que la page la déclare — mais on refuse de
    poster ailleurs que chez l'organisme."""
    declaree = reglages_js.get("ajaxurl")
    if not declaree:
        # Sans cette garde, urljoin rendrait la racine du site : on posterait
        # sur la page d'accueil et l'erreur remontée parlerait de JSON illisible
        # au lieu de la clé disparue.
        raise RuntimeError("bookacti_localized ne déclare plus d'ajaxurl : "
                           "le greffon a-t-il changé ?")
    url = urljoin(BASE_URL, declaree)
    if urlparse(url).netloc != urlparse(BASE_URL).netloc:
        raise RuntimeError(f"URL AJAX inattendue, hors du domaine : {url!r}")
    return url


def _intervalle(aujourd_hui: date) -> dict:
    debut = aujourd_hui.replace(month=1, day=1)
    fin = debut.replace(year=debut.year + ANNEES_DEMANDEES)
    return {"start": f"{debut} 00:00:00", "end": f"{fin} 23:59:59"}


def _duree_jours(duree_activite: str | None) -> float | int | None:
    """« JJJ.HH:MM:SS » -> nombre de jours de formation.

    Le calendrier ne dit jamais « une demi-journée » : il dit qu'une
    sensibilisation ATEX niveau 0 dure 000.04:00:00. Compter les jours
    calendaires écraserait ces demi-journées à 1, d'où la conversion des
    heures restantes à l'échelle d'une journée de cours. Les huit valeurs
    publiées retombent ainsi sur des demis exacts, tous conformes aux
    « Durée : N jour(s) » des fiches /form/ (vérifié sur les 28 formations
    qui en publient une, de 0,5 à 4 jours).
    """
    m = _RE_DUREE.match(duree_activite or "")
    if not m:
        return None
    jours, heures, minutes, secondes = (int(g) for g in m.groups())
    reste_h = heures + minutes / 60 + secondes / 3600
    total = jours + round(reste_h / JOURNEE_PEDAGOGIQUE_H * 2) / 2
    if total <= 0:
        return None
    return int(total) if float(total).is_integer() else total


def _jour_iso(horodatage: str) -> str | None:
    """« 2026-09-07 08:00:00 » -> « 2026-09-07 », et rien d'autre.

    Le greffon date ses occurrences en ISO, donc une simple découpe suffirait ;
    on la vérifie quand même, car une date d'un autre format recopiée telle
    quelle ne se distinguerait plus d'une date valide une fois en base.
    """
    jour = horodatage[:10]
    try:
        date.fromisoformat(jour)
    except ValueError:
        return None
    return jour


def _url_programme(activite: dict) -> str | None:
    message = (activite.get("settings") or {}).get("activity_message") or ""
    m = _RE_PDF.search(message)
    return urljoin(BASE_URL, m.group(1)) if m else None


def _remarque(debut: str, fin: str, duree: float | int | None) -> str | None:
    """Quatre sessions (les deux « Plan de prévention ») sont saisies en
    multiples de 24 h : elles se terminent à l'heure où elles commencent, le
    lendemain de leur dernière journée de cours. On publie les dates et la
    durée telles que le site les donne, et on signale l'écart plutôt que de
    trancher à sa place."""
    heure_debut, heure_fin = debut[11:], fin[11:]
    # Le jour où le greffon ne daterait plus qu'à la journée, les deux heures
    # seraient vides et donc « égales » : on affirmerait un écart qui ne se
    # constate plus. Sans heure publiée, pas de remarque.
    if duree is None or not heure_debut or heure_debut != heure_fin:
        return None
    if debut[:10] == fin[:10]:
        return None
    return (f"le site fait finir la session à son heure de début : dates "
            f"affichées du {debut[:10]} au {fin[:10]} pour une durée publiée "
            f"de {duree} jour(s)")


def _famille(titre: str) -> str | None:
    m = _RE_FAMILLE.match(titre)
    return m.group(1) if m else None


def _sessions(donnees: dict) -> list[dict]:
    evenements = donnees.get("events")
    activites = donnees.get("activities_data")
    if (not isinstance(evenements, list)
            or not isinstance(activites, dict) or not activites):
        raise RuntimeError("Réponse AJAX sans events/activities_data "
                           "exploitables : format du greffon modifié ?")

    sessions = []
    for evenement in evenements:
        titre = (evenement.get("title") or "").strip()
        debut, fin = evenement.get("start") or "", evenement.get("end") or ""
        jour_debut, jour_fin = _jour_iso(debut), _jour_iso(fin)
        if not titre or not jour_debut or not jour_fin:
            continue

        # L'activité porte la durée et le lien vers le programme ; les
        # occurrences, elles, ne portent que leurs dates.
        activite = activites.get(str(evenement.get("activity_id"))) or {}
        duree = _duree_jours(activite.get("duration"))

        sessions.append({
            "organisme": ORGANISME,
            "formation": titre,
            "type_formation": _famille(titre),
            "ville": VILLE,
            "date_debut": jour_debut,
            "date_fin": jour_fin,
            "duree_jours": duree,
            "tarif": None,          # absent du calendrier, voir l'en-tête
            "remarque": _remarque(debut, fin, duree),
            "disponibilite": None,  # aucun compteur exploitable, voir l'en-tête
            "url_programme": _url_programme(activite),
            "source_url": SOURCE_URL,
        })

    # Des occurrences reçues mais pas une seule retenue : c'est une rupture de
    # format, pas un calendrier vide. La distinction se perdrait si on rendait
    # simplement une liste vide, que le pipeline enregistrerait sans broncher.
    if evenements and not sessions:
        raise RuntimeError(f"{len(evenements)} occurrences reçues mais aucune "
                           "exploitable : titres ou dates au format inattendu ?")
    return sessions


def scrape() -> list[dict]:
    """Point d'entrée : retourne toutes les sessions du planning INTERFORA."""
    page_html = _fetch(PLANNING_URL)
    config_calendrier = _objet_json(page_html, _RE_CONFIG,
                                    "La configuration du calendrier")
    reglages_js = _objet_json(page_html, _RE_LOCALIZED, "bookacti_localized")

    cles_acceptees = reglages_js.get("booking_system_attributes_keys")
    if not cles_acceptees:
        raise RuntimeError("booking_system_attributes_keys absent : impossible "
                           "de savoir quels attributs le serveur accepte.")
    # Le serveur ignore — voire refuse — les attributs hors de sa liste
    # blanche : on lui renvoie exactement ce que le calendrier lui enverrait.
    attributs = {c: config_calendrier[c] for c in cles_acceptees
                 if c in config_calendrier}
    if not attributs:
        # Deux listes qui ne se recoupent plus : le POST partirait vide et le
        # serveur répondrait un calendrier sans rapport avec cette page.
        raise RuntimeError("Aucun attribut commun entre la configuration du "
                           "calendrier et la liste blanche du serveur : "
                           "le greffon a-t-il changé de vocabulaire ?")

    time.sleep(DELAY_BETWEEN_PAGES)
    reponse_brute = _fetch(_url_ajax(reglages_js), {
        "action": ACTION_AJAX,
        "attributes": json.dumps(attributs),
        "interval": json.dumps(_intervalle(date.today())),
    })
    try:
        reponse = json.loads(reponse_brute)
    except ValueError as erreur:
        # Page de maintenance, pare-feu applicatif, action renommée : la
        # réponse est alors du HTML, et le décodeur seul ne le dirait pas.
        raise RuntimeError(f"L'action {ACTION_AJAX} n'a pas répondu du JSON "
                           f"({erreur}) : {reponse_brute[:200]!r}") from erreur
    if reponse.get("status") != "success":
        raise RuntimeError(f"L'action {ACTION_AJAX} a répondu "
                           f"{reponse.get('status')!r} : {reponse.get('message')}")

    sessions = _sessions(reponse.get("booking_system_data") or {})
    if not sessions:
        raise RuntimeError("Aucune session dans le calendrier INTERFORA : "
                           "programmation vide, ou format de réponse modifié ?")
    return sessions
