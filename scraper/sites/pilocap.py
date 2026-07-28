"""Scraper PILOCAP (formation-pilocap.fr) — stdlib uniquement.

Site WordPress/Elementor. Chaque page de centre embarque un planning rendu
côté serveur (plugin « sji ») : un tableau dont chaque ligne est une session.

    <tr>
        <td class="sji-code-session">2026-07-032</td>
        <td data-search="Habilitations électriques"><span class='badge'>...</span></td>
        <td>Intitulé de la formation<br><span class="sji-formation-note">note</span></td>
        <td data-order="2">2,0 jours</td>
        <td data-order="20260730">30/07/2026</td>
        <td data-order="20260731">31/07/2026</td>
        <td><span class="sji-badge-dispo ...">Places disponibles</span></td>
    </tr>

Les lignes « entrée/sortie permanente » (class sji-row-permanente) n'ont pas
de dates fixes : data-order="00000000" -> dates NULL en base.
"""

import html as html_lib
import re
import time
from urllib.parse import unquote
import urllib.request

ORGANISME = "PILOCAP"
BASE_URL = "https://formation-pilocap.fr/"
CENTRES_URL = BASE_URL + "centres-formation/"
USER_AGENT = "ScrapFormationInterne/1.0 (veille catalogue formations)"
DELAY_BETWEEN_PAGES = 1.0  # secondes, politesse

_RE_LIGNE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
_RE_CELLULE = re.compile(r"<td[^>]*>.*?</td>", re.S)
_RE_DATA_SEARCH = re.compile(r'data-search="([^"]*)"')
_RE_DATA_ORDER = re.compile(r'data-order="(\d{8})"')
_RE_NOTE = re.compile(r'<span class="sji-formation-note">(.*?)</span>', re.S)
_RE_DUREE = re.compile(r"(\d+(?:[.,]\d+)?)\s*jour")

# mots des slugs d'URL qui ne font pas partie du nom de la ville
_MOTS_TECHNIQUES = {"centre", "de", "formation", "caces", "catec", "odf", "by", "pilocap"}
_LIAISONS = {"en", "du", "la", "le", "les", "sur", "sous", "aux"}


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _texte(fragment_html: str) -> str:
    txt = re.sub(r"<br\s*/?>", " ", fragment_html)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = html_lib.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


def _ville_depuis_url(url: str) -> str:
    slug = unquote(url).rstrip("/").rsplit("/", 1)[-1]
    mots = [m for m in slug.split("-")
            if m not in _MOTS_TECHNIQUES and not m.isdigit()]
    # les mots de liaison restent en minuscule, sauf en tête (« La Reunion »)
    return " ".join(m if m in _LIAISONS and i > 0 else m.capitalize()
                    for i, m in enumerate(mots))


def _date_iso(data_order: str) -> str | None:
    """'20260730' -> '2026-07-30' ; '00000000' (permanente) -> None."""
    if not data_order or data_order == "00000000":
        return None
    return f"{data_order[0:4]}-{data_order[4:6]}-{data_order[6:8]}"


def _decouvrir_centres(page_html: str) -> list[str]:
    urls = []
    for href in re.findall(r'href="(https://formation-pilocap\.fr/centres-formation/[^"#]+)"',
                           page_html):
        if href.rstrip("/") != CENTRES_URL.rstrip("/") and href not in urls:
            urls.append(href)
    return urls


def _parse_page_centre(page_html: str, url_page: str) -> list[dict]:
    ville = _ville_depuis_url(url_page)
    sessions = []
    for m in _RE_LIGNE.finditer(page_html):
        ligne = m.group(0)
        if "sji-code-session" not in ligne:
            continue
        cellules = _RE_CELLULE.findall(ligne)
        if len(cellules) < 7:
            continue

        m_type = _RE_DATA_SEARCH.search(cellules[1])
        type_formation = html_lib.unescape(m_type.group(1)).strip() if m_type else None

        m_note = _RE_NOTE.search(cellules[2])
        remarque = _texte(m_note.group(1)) if m_note else None
        formation = _texte(_RE_NOTE.sub("", cellules[2]))
        if not formation:
            continue

        m_duree = _RE_DUREE.search(_texte(cellules[3]))
        duree = float(m_duree.group(1).replace(",", ".")) if m_duree else None
        if duree is not None and duree.is_integer():
            duree = int(duree)

        m_debut = _RE_DATA_ORDER.search(cellules[4])
        m_fin = _RE_DATA_ORDER.search(cellules[5])
        date_debut = _date_iso(m_debut.group(1)) if m_debut else None
        date_fin = _date_iso(m_fin.group(1)) if m_fin else None
        if date_debut is None and date_fin is None and not remarque:
            remarque = "Entrée/sortie permanente"

        sessions.append({
            "organisme": ORGANISME,
            "formation": formation,
            "type_formation": type_formation,
            "ville": ville,
            "date_debut": date_debut,
            "date_fin": date_fin,
            "duree_jours": duree,
            "tarif": None,  # pas de tarif dans le planning public
            "remarque": remarque,
            "disponibilite": _texte(cellules[6]) or None,
            "url_programme": None,
            "source_url": url_page,
        })
    return sessions


def scrape() -> list[dict]:
    """Point d'entrée : retourne toutes les sessions trouvées sur le site."""
    centres = _decouvrir_centres(_fetch(CENTRES_URL))
    if not centres:
        raise RuntimeError("Aucun centre trouvé : la structure du site a changé ?")

    sessions = []
    for url in centres:
        time.sleep(DELAY_BETWEEN_PAGES)
        sessions.extend(_parse_page_centre(_fetch(url), url))
    return sessions
