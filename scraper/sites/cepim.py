"""Scraper CEPIM (cepim.fr) — stdlib uniquement.

La page /planning/ embarque la totalité des sessions dans un moteur de
recherche client (plugin WordPress « wpulivesearch ») :

    window.wpulivesearch_datas_keys = ["html", "location", "formation_id",
                                       "formation_family", "name"];
    window.wpulivesearch_datas = [[<fragment HTML>, "Rungis", "450", [9],
                                   "Chariot automoteur ... R489"], ...];

Chaque fragment HTML contient en plus : la famille de formation (div
« c-muted »), la période (« Du 28 au 31 Juil 2026 », « 05 Août 2026 »,
« Du 28 Août au 01 Sep 2026 »), le tarif et le lien vers la fiche.

Une seule requête HTTP suffit donc pour tout le catalogue daté.
"""

import html as html_lib
import json
import re
import unicodedata
from datetime import date
import urllib.request
from urllib.parse import urljoin

ORGANISME = "CEPIM"
PLANNING_URL = "https://www.cepim.fr/planning/"
USER_AGENT = "Mozilla/5.0 (compatible; ScrapFormationInterne/1.0)"

MOIS_FR = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
           "aout", "septembre", "octobre", "novembre", "decembre"]

_RE_PERIODE_MEME_MOIS = re.compile(r"^Du (\d{1,2}) au (\d{1,2}) (\S+) (\d{4})$")
_RE_PERIODE_DEUX_MOIS = re.compile(r"^Du (\d{1,2}) (\S+) au (\d{1,2}) (\S+) (\d{4})$")
_RE_JOUR_UNIQUE = re.compile(r"^(\d{1,2}) (\S+) (\d{4})$")


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _sans_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def _mois_num(token: str) -> int | None:
    """« Juil », « Août », « Sep. », « décembre »… -> numéro de mois.
    Correspondance par préfixe (unique) sur les noms complets sans accents."""
    t = _sans_accents(token).lower().strip(". ")
    if not t:
        return None
    candidats = [i + 1 for i, m in enumerate(MOIS_FR) if m.startswith(t)]
    return candidats[0] if len(candidats) == 1 else None


def _parse_periode(texte: str) -> tuple[date, date] | None:
    """Parse les périodes affichées par le site (année en fin de chaîne).
    Pour « Du 28 Déc au 02 Jan 2027 », l'année de début est déduite."""
    texte = re.sub(r"\s+", " ", texte.replace(" ", " ")).strip()

    m = _RE_PERIODE_MEME_MOIS.match(texte)
    if m:
        mois = _mois_num(m.group(3))
        if mois:
            try:
                return (date(int(m.group(4)), mois, int(m.group(1))),
                        date(int(m.group(4)), mois, int(m.group(2))))
            except ValueError:
                return None

    m = _RE_PERIODE_DEUX_MOIS.match(texte)
    if m:
        mois_d, mois_f = _mois_num(m.group(2)), _mois_num(m.group(4))
        annee_f = int(m.group(5))
        if mois_d and mois_f:
            annee_d = annee_f - 1 if mois_d > mois_f else annee_f
            try:
                return (date(annee_d, mois_d, int(m.group(1))),
                        date(annee_f, mois_f, int(m.group(3))))
            except ValueError:
                return None

    m = _RE_JOUR_UNIQUE.match(texte)
    if m:
        mois = _mois_num(m.group(2))
        if mois:
            try:
                jour = date(int(m.group(3)), mois, int(m.group(1)))
                return (jour, jour)
            except ValueError:
                return None
    return None


def _ville(location: str) -> str:
    """« CEPIM - Montoir-de-Bretagne » -> « Montoir-de-Bretagne »,
    « CEPIM Entreprises - PLOUGOUMELEN » -> « Plougoumelen »."""
    v = re.sub(r"^CEPIM[^-]*-\s*", "", location).strip()
    if v.isupper():
        v = v.title()
    return v


def _extraire_datas(page_html: str) -> tuple[list, list]:
    def extraire(nom):
        m = re.search(r"window\." + nom + r"\s*=\s*", page_html)
        if not m:
            raise RuntimeError(f"{nom} introuvable sur /planning/ : "
                               "la structure du site a changé ?")
        fin = page_html.find("</script>", m.end())
        return json.loads(page_html[m.end():fin].strip().rstrip(";"))

    return extraire("wpulivesearch_datas"), extraire("wpulivesearch_datas_keys")


def scrape() -> list[dict]:
    """Point d'entrée : retourne toutes les sessions du planning CEPIM."""
    page_html = _fetch(PLANNING_URL)
    datas, keys = _extraire_datas(page_html)
    idx = {k: i for i, k in enumerate(keys)}
    if "html" not in idx or "location" not in idx or "name" not in idx:
        raise RuntimeError(f"Clés wpulivesearch inattendues : {keys}")

    sessions = []
    for row in datas:
        fragment = row[idx["html"]]

        m_periode = re.search(r'wputh-time-period">([^<]+)<', fragment)
        if not m_periode:
            continue
        periode = _parse_periode(html_lib.unescape(m_periode.group(1)))
        if not periode:
            continue
        debut, fin = periode

        m_famille = re.search(r'c-muted">([^<]+)<', fragment)
        m_tarif = re.search(r'session-tarif">([^<]+)<', fragment)
        m_fiche = re.search(r'href="(/formations/[^"]+)"', fragment)
        tarif = None
        if m_tarif:
            tarif = re.sub(r"\s+", " ", html_lib.unescape(m_tarif.group(1))).strip()

        sessions.append({
            "organisme": ORGANISME,
            "formation": html_lib.unescape(row[idx["name"]]).strip(),
            "type_formation": html_lib.unescape(m_famille.group(1)).strip()
                              if m_famille else None,
            "ville": _ville(html_lib.unescape(row[idx["location"]])),
            "date_debut": debut.isoformat(),
            "date_fin": fin.isoformat(),
            "duree_jours": (fin - debut).days + 1,
            "tarif": tarif,
            "remarque": None,
            "disponibilite": None,
            "url_programme": urljoin(PLANNING_URL, html_lib.unescape(m_fiche.group(1)))
                             if m_fiche else None,
            "source_url": PLANNING_URL,
        })

    if not sessions:
        raise RuntimeError("Aucune session extraite du planning CEPIM : "
                           "mise en page modifiée ?")
    return sessions
