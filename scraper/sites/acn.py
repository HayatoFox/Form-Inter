"""Scraper Groupe ACN (groupe-acn.fr) — stdlib uniquement.

Le sitemap liste ~280 fiches formation (motif ``...-i<N>.html``). Chaque fiche
peut contenir un tableau « Calendrier de formation » :

    <tr>
        <td data-label="Début :">03/08/2026</td>
        <td data-label="Fin :">04/08/2026</td>
        <td data-label="Lieu :">Bailly Romainvilliers - Marne la Vallée (77)</td>
        <td><a href="reservation-...-d5134.html">Réserver</a></td>
    </tr>

La catégorie (type de formation) n'apparaît pas sur la fiche : elle est
reconstituée en parcourant les pages de catégories (formation-*.html), qui
listent leurs fiches. Le tarif et la durée affichée (en heures) sont repris
de la fiche ; la durée en jours est calculée depuis les dates.
"""

import html as html_lib
import re
import time
import unicodedata
import urllib.request
from datetime import date
from urllib.parse import urljoin

ORGANISME = "Groupe ACN"
BASE_URL = "https://www.groupe-acn.fr/"
SITEMAP_URL = BASE_URL + "sitemap.xml"
USER_AGENT = "Mozilla/5.0 (compatible; ScrapFormationInterne/1.0)"
DELAY_BETWEEN_PAGES = 0.5  # secondes ; ~300 pages par passage

_RE_LOC = re.compile(r"<loc>(https://www\.groupe-acn\.fr/[^<]+)</loc>")
_RE_LANGUE = re.compile(r"https://www\.groupe-acn\.fr/(en|pt|pl|it|nl|da|de|ro|es)/")
_RE_FICHE = re.compile(r"-i\d+\.html$")
_RE_CATEGORIE = re.compile(r"https://www\.groupe-acn\.fr/formations?-[a-z0-9-]+\.html$")
_RE_LIGNE_CAL = re.compile(
    r'<td data-label="Début\s*:">\s*(\d{2}/\d{2}/\d{4})\s*</td>\s*'
    r'<td data-label="Fin\s*:">\s*(\d{2}/\d{2}/\d{4})\s*</td>\s*'
    r'<td data-label="Lieu\s*:">\s*(.*?)\s*</td>', re.S)
_RE_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
_RE_TARIF = re.compile(
    r"Tarif de la formation</p>(.*?)(?:<a\b|</div>)", re.S)
_RE_DUREE_H = re.compile(r"Durée\s*(?:</[^>]+>\s*<[^>]+>)?\s*([\d,.]+\s*heures?)")


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _texte(fragment_html: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", fragment_html)
    return re.sub(r"\s+", " ", html_lib.unescape(txt)).strip()


def _date_iso(jj_mm_aaaa: str) -> str | None:
    j, m, a = jj_mm_aaaa.split("/")
    try:
        return date(int(a), int(m), int(j)).isoformat()
    except ValueError:
        return None


def _ville(lieu: str) -> str:
    """Le site orthographie les lieux de façon incohérente (« Marne la
    Vallée » / « Marne La Vallee », point ou chiffre parasites…) : on
    normalise (sans accents, casse titre) pour unifier les variantes."""
    lieu = _texte(lieu)
    lieu = re.sub(r"^[.\s]+", "", lieu)          # « .Bailly… »
    lieu = re.sub(r"\)\s*\d+$", ")", lieu)       # « …(77)1 »
    lieu = "".join(c for c in unicodedata.normalize("NFD", lieu)
                   if unicodedata.category(c) != "Mn")
    return lieu.title()


# Repli quand une fiche n'est référencée par aucune page de catégorie
_TYPES_REPLI = [
    (re.compile(r"electri", re.I), "Formations habilitation électrique"),
    (re.compile(r"mecanique", re.I), "Formations habilitation mécanique"),
    (re.compile(r"SSIAP|incendie|extincteur|évacuation|evacuation", re.I),
     "Formations sécurité incendie"),
    (re.compile(r"CACES|R4[89]\d|engin", re.I), "Formations engins de chantier"),
    (re.compile(r"SST|secouris|défibrill|defibrill", re.I), "Formations secourisme"),
    (re.compile(r"hauteur|harnais|échafaud|echafaud", re.I),
     "Formations travail en hauteur"),
    (re.compile(r"AIPR", re.I), "Formations AIPR"),
    (re.compile(r"gestes et postures|ergonomi", re.I),
     "Formations gestes et postures"),
    (re.compile(r"CSE|CSSCT", re.I), "Formations CSE - CSSCT"),
    (re.compile(r"RPS|management|manager", re.I), "Formations en management - RH"),
]


def _type_repli(formation: str) -> str | None:
    for motif, type_ in _TYPES_REPLI:
        if motif.search(formation):
            return type_
    return None


def _urls_depuis_sitemap() -> tuple[list[str], list[str]]:
    xml = _fetch(SITEMAP_URL)
    urls_fr = [u for u in _RE_LOC.findall(xml) if not _RE_LANGUE.match(u)]
    fiches = sorted({u for u in urls_fr if _RE_FICHE.search(u)})
    categories = sorted({u for u in urls_fr
                         if _RE_CATEGORIE.match(u) and not _RE_FICHE.search(u)})
    return fiches, categories


def _carte_categories(categories: list[str]) -> dict[str, str]:
    """Associe chaque URL de fiche au nom (h1) de sa page de catégorie."""
    carte = {}
    for url in categories:
        time.sleep(DELAY_BETWEEN_PAGES)
        try:
            page = _fetch(url)
        except Exception:
            continue  # une catégorie qui tombe ne bloque pas le reste
        m = _RE_H1.search(page)
        if not m:
            continue
        nom = _texte(m.group(1)).split(":")[0].strip()
        for lien in re.findall(r'href="([^"]*-i\d+\.html)"', page):
            carte.setdefault(urljoin(url, lien), nom)
    return carte


def _parse_fiche(page_html: str, url: str, categorie: str | None) -> list[dict]:
    m_h1 = _RE_H1.search(page_html)
    formation = _texte(m_h1.group(1)) if m_h1 else None
    if not formation:
        return []
    if not categorie:
        categorie = _type_repli(formation)

    m_tarif = _RE_TARIF.search(page_html)
    tarif = _texte(m_tarif.group(1)) if m_tarif else None
    m_duree = _RE_DUREE_H.search(page_html)
    remarque = f"Durée annoncée : {m_duree.group(1).strip()}" if m_duree else None

    sessions = []
    for debut, fin, lieu in _RE_LIGNE_CAL.findall(page_html):
        date_debut, date_fin = _date_iso(debut), _date_iso(fin)
        if not date_debut or not date_fin:
            continue
        sessions.append({
            "organisme": ORGANISME,
            "formation": formation,
            "type_formation": categorie,
            "ville": _ville(lieu),
            "date_debut": date_debut,
            "date_fin": date_fin,
            "duree_jours": (date.fromisoformat(date_fin)
                            - date.fromisoformat(date_debut)).days + 1,
            "tarif": tarif,
            "remarque": remarque,
            "disponibilite": None,
            "url_programme": url,
            "source_url": url,
        })
    return sessions


def scrape() -> list[dict]:
    """Point d'entrée : parcourt toutes les fiches listées dans le sitemap."""
    fiches, categories = _urls_depuis_sitemap()
    if not fiches:
        raise RuntimeError("Aucune fiche formation dans le sitemap : "
                           "la structure du site a changé ?")
    carte = _carte_categories(categories)

    sessions = []
    for url in fiches:
        time.sleep(DELAY_BETWEEN_PAGES)
        try:
            page = _fetch(url)
        except Exception:
            continue  # fiche indisponible : on n'interrompt pas le passage
        sessions.extend(_parse_fiche(page, url, carte.get(url)))
    return sessions
