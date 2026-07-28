"""Scraper VoltWork (voltwork.fr) — stdlib uniquement.

Formations habilitations électriques, centres à Paris, Marseille, etc.
Les seules dates maintenues du site sont les grilles « vw-planning » :

    <div class="vw-planning-container"><div class="vw-grid-table">
      <div class="vw-row vw-header">…</div>
      <div class="vw-row">
        <div class="vw-col-formation …">Habilitations<br><strong>B1V B2V BR BC
             BE Essai</strong><br><em>Formation Initiale</em></div>
        <div class="vw-col-dates …">
            <div class="vw-date-item">27/07/26 au 29/07/26</div>
            <div class="vw-date-item">Le 31/08/26</div> …

Pièges gérés :
- ~155 pages SEO par ville reprennent la grille du centre le plus proche
  (Vitrolles = Aix = Marseille…) : déduplication par signature de grille,
  la page « hub » (/habilitation-electrique/<ville>/) est canonique.
- Les fiches formation et pages IRVE affichent aussi des tableaux de dates,
  mais périmés (non mis à jour) : ignorés volontairement.
- Le tarif est associé depuis le tableau de prix de la page quand la
  correspondance formation <-> ligne de prix est sans ambiguïté.
"""

import hashlib
import html as html_lib
import re
import time
import unicodedata
import urllib.request
from datetime import date

ORGANISME = "VoltWork"
BASE_URL = "https://www.voltwork.fr/"
SITEMAPS = [BASE_URL + "page-sitemap.xml", BASE_URL + "centres-sitemap.xml"]
USER_AGENT = "Mozilla/5.0 (compatible; ScrapFormationInterne/1.0)"
DELAY_BETWEEN_PAGES = 0.5  # secondes ; ~200 pages par passage

_RE_LOC = re.compile(r"<loc>(https://www\.voltwork\.fr/[^<]+)</loc>")
_RE_HUB = re.compile(r"/habilitation-electrique/([^/]+)/$")
_RE_SEO = re.compile(r"/centres/(?:centre-)?formation-habilitation-electrique-([^/]+)/$")
_RE_ROW = re.compile(r'(?=<div class="vw-row)')
_RE_COL_FORMATION = re.compile(r'vw-col-formation[^"]*">(.*?)</div>', re.S)
_RE_DATE_ITEM = re.compile(r'vw-date-item">([^<]+)<')
_RE_PLAGE = re.compile(r"(\d{2})/(\d{2})/(\d{2})(?:\s*au\s*(\d{2})/(\d{2})/(\d{2}))?")
_RE_CELLULE = re.compile(r"<td.*?</td>", re.S)
_RE_LIGNE_TABLE = re.compile(r"<tr.*?</tr>", re.S)

_LIAISONS = {"en", "de", "du", "la", "le", "les", "sur", "sous", "aux", "et"}

# jetons de slug qui décrivent la formation, pas la ville
# (ex. /habilitation-electrique/formation-b1v-b2v-br-bc-paris/ -> Paris)
_TOKENS_TECHNIQUES = re.compile(
    r"^(formations?|habilitations?|electrique|essai|manoeuvre|mesurage|"
    r"verification|recyclage|initiale|centre|irve|sst|epi|photovoltaique|"
    r"vehicule)$")
_TOKENS_CODES = re.compile(r"^[bh]\d?[a-z0-9]{0,3}$")  # b1v, br, bc, h0b0, hf…


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _texte(fragment_html: str) -> str:
    txt = re.sub(r"<br\s*/?>", " ", fragment_html)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = html_lib.unescape(txt).replace("﻿", "")
    return re.sub(r"\s+", " ", txt).strip()


def _normaliser(s: str) -> str:
    """Clé de comparaison : sans accents, alphanumérique majuscule."""
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def _ville_depuis_url(url: str) -> str:
    m = _RE_HUB.search(url) or _RE_SEO.search(url)
    slug = m.group(1) if m else url.rstrip("/").rsplit("/", 1)[-1]
    mots = [t for t in slug.split("-")
            if not _TOKENS_TECHNIQUES.match(t) and not _TOKENS_CODES.match(t)]
    if not mots:  # slug purement technique : pas de ville identifiable
        mots = slug.split("-")
    return "-".join(m if m in _LIAISONS and i > 0 else m.capitalize()
                    for i, m in enumerate(mots))


def _parse_dates(item: str) -> tuple[date, date] | None:
    m = _RE_PLAGE.search(item)
    if not m:
        return None
    try:
        debut = date(2000 + int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if m.group(4):
            fin = date(2000 + int(m.group(6)), int(m.group(5)), int(m.group(4)))
        else:
            fin = debut
        return debut, fin
    except ValueError:
        return None


def _parse_grille(page_html: str) -> list[dict]:
    """Retourne les lignes de la grille : {formation, variante, plages}."""
    i = page_html.find("vw-planning-container")
    if i < 0:
        return []
    lignes = []
    for bloc in _RE_ROW.split(page_html[i:]):
        if "vw-header" in bloc[:80] or "vw-footer" in bloc[:80]:
            continue
        m_form = _RE_COL_FORMATION.search(bloc)
        if not m_form:
            continue
        m_code = re.search(r"<strong>(.*?)</strong>", m_form.group(1), re.S)
        m_variante = re.search(r"<em>(.*?)</em>", m_form.group(1), re.S)
        plages = [p for p in (_parse_dates(d) for d in _RE_DATE_ITEM.findall(bloc)) if p]
        if not plages:
            continue
        lignes.append({
            "formation": _texte(m_form.group(1)),
            "code": _texte(m_code.group(1)) if m_code else "",
            "variante": _texte(m_variante.group(1)) if m_variante else "",
            "plages": plages,
        })
    return lignes


def _parse_tarifs(page_html: str) -> list[tuple[str, str]]:
    """Lignes du tableau de prix : (libellé, tarifs concaténés)."""
    tarifs = []
    for ligne in _RE_LIGNE_TABLE.findall(page_html):
        cellules = [_texte(c) for c in _RE_CELLULE.findall(ligne)]
        if len(cellules) >= 3 and "€" in cellules[1]:
            tarifs.append((cellules[0],
                           f"{cellules[1]} / stagiaire (inter) ; "
                           f"{cellules[2]} / groupe (intra)"))
    return tarifs


def _tarif_pour(ligne: dict, tarifs: list[tuple[str, str]]) -> str | None:
    """Associe une ligne de grille à une ligne de prix, si sans ambiguïté."""
    code = _normaliser(ligne["code"])
    variante = _normaliser(ligne["variante"])
    candidats = []
    for libelle, tarif in tarifs:
        cle = _normaliser(libelle)
        code_prix = cle.replace("HABILITATIONS", "").replace("INITIALE", "") \
                       .replace("RECYCLAGE", "")
        if code_prix and code_prix in code:
            # la variante du prix (Initiale/Recyclage) doit être compatible
            if ("INITIALE" in cle) != ("INITIALE" in variante) and \
               ("RECYCLAGE" in cle) != ("RECYCLAGE" in variante):
                continue
            candidats.append((len(code_prix), tarif))
    if not candidats:
        return None
    candidats.sort(reverse=True)
    if len(candidats) > 1 and candidats[0][0] == candidats[1][0] \
            and candidats[0][1] != candidats[1][1]:
        return None  # ambigu
    return candidats[0][1]


def _urls_depuis_sitemaps() -> list[str]:
    urls = []
    for sitemap in SITEMAPS:
        for u in _RE_LOC.findall(_fetch(sitemap)):
            if "/en/" not in u and u not in urls:
                urls.append(u)
    return urls


def scrape() -> list[dict]:
    """Point d'entrée : collecte les grilles de dates, dédupliquées par centre."""
    pages = _urls_depuis_sitemaps()
    if not pages:
        raise RuntimeError("Sitemaps VoltWork vides : la structure du site a changé ?")

    # signature de grille -> page canonique (les hubs priment sur les pages SEO)
    grilles: dict[str, dict] = {}
    for url in pages:
        time.sleep(DELAY_BETWEEN_PAGES)
        try:
            page = _fetch(url)
        except Exception:
            continue
        lignes = _parse_grille(page)
        if not lignes:
            continue
        signature = hashlib.md5(repr(
            [(l["formation"], l["plages"]) for l in lignes]).encode()).hexdigest()
        priorite = 0 if _RE_HUB.search(url) else 1
        if signature not in grilles or priorite < grilles[signature]["priorite"]:
            grilles[signature] = {"url": url, "priorite": priorite,
                                  "lignes": lignes, "tarifs": _parse_tarifs(page)}

    sessions = []
    for g in grilles.values():
        ville = _ville_depuis_url(g["url"])
        for ligne in g["lignes"]:
            tarif = _tarif_pour(ligne, g["tarifs"])
            for debut, fin in ligne["plages"]:
                sessions.append({
                    "organisme": ORGANISME,
                    "formation": ligne["formation"],
                    "type_formation": "Habilitations électriques",
                    "ville": ville,
                    "date_debut": debut.isoformat(),
                    "date_fin": fin.isoformat(),
                    "duree_jours": (fin - debut).days + 1,
                    "tarif": tarif,
                    "remarque": None,
                    "disponibilite": None,
                    "url_programme": g["url"],
                    "source_url": g["url"],
                })
    if not sessions:
        raise RuntimeError("Aucune grille de dates trouvée sur voltwork.fr : "
                           "structure modifiée ?")
    return sessions
