"""Scraper TEMIS Formation (temis-formation.fr) — stdlib uniquement.

Le site est fait avec l'éditeur IONOS : chaque page d'antenne empile des
modules dans l'ordre du document. Un bloc formation correspond à :

    module imageSubtitle  -> visuel avec le nom de la formation (image, pas de texte)
    module table          -> ligne 1 : mois, lignes suivantes : plages de jours
    module text           -> "Tarif : XXX € H.T/pers" + liens Programme/Inscription/Devis

Le nom et la catégorie de la formation sont déduits de l'URL du lien
« Programme » (ex. /secourisme/sauveteur-secourisme-du-travail-s-s-t/).
Le HTML étant généré par le CMS, sa structure est assez régulière pour un
parsing par expressions régulières.
"""

import html as html_lib
import re
import time
import unicodedata
import urllib.request
from datetime import date
from urllib.parse import unquote, urljoin, urlparse

ORGANISME = "TEMIS Formation"
BASE_URL = "https://www.temis-formation.fr/"
USER_AGENT = "ScrapFormationInterne/1.0 (veille catalogue formations)"
DELAY_BETWEEN_PAGES = 1.0  # secondes, politesse

MOIS = {
    "JANVIER": 1, "FEVRIER": 2, "MARS": 3, "AVRIL": 4, "MAI": 5, "JUIN": 6,
    "JUILLET": 7, "AOUT": 8, "SEPTEMBRE": 9, "OCTOBRE": 10,
    "NOVEMBRE": 11, "DECEMBRE": 12,
}

# mots de liaison à garder en minuscule dans les noms de ville
_LIAISONS = {"en", "de", "du", "la", "le", "les", "sur", "sous", "aux"}

_RE_MODULE = re.compile(r'(?=<div class="n module-type-)')
_RE_TYPE_MODULE = re.compile(r'<div class="n module-type-(\w+)')
_RE_LIGNE = re.compile(r"<tr.*?</tr>", re.S)
_RE_CELLULE = re.compile(r"<td.*?</td>", re.S)
_RE_PLAGE = re.compile(r"(\d{1,2})(?:\s*(?:au|à|-|–)\s*(\d{1,2}))?")
_RE_LIEN = re.compile(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S)
_RE_TARIF = re.compile(r"Tarif\s*:?\s*(.+)")
_RE_PARAGRAPHE = re.compile(r"<(?:p|h\d)[^>]*>(.*?)</(?:p|h\d)>", re.S)


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _texte(fragment_html: str) -> str:
    """Supprime scripts et balises, décode les entités, normalise les espaces."""
    txt = re.sub(r"<script.*?</script>", " ", fragment_html, flags=re.S)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = html_lib.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


def _modules(page_html: str) -> list[tuple[str, str]]:
    """Découpe la page en modules CMS, dans l'ordre du document."""
    resultat = []
    for morceau in _RE_MODULE.split(page_html):
        m = _RE_TYPE_MODULE.match(morceau)
        if m:
            resultat.append((m.group(1), morceau))
    return resultat


def _sans_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def _ville_depuis_url(url: str) -> str:
    m = re.search(r"(?:antenne-de-|centre-de-)([^/]+)", unquote(url))
    if not m:
        return ""
    mots = m.group(1).rstrip("/").split("-")
    return "-".join(w if w in _LIAISONS else w.capitalize() for w in mots)


def _libelle_depuis_slug(slug: str) -> str:
    txt = unquote(slug).strip("/").replace("-", " ").strip()
    return txt[:1].upper() + txt[1:] if txt else ""


def _annee_pour_mois(mois: int, aujourd_hui: date) -> int:
    """Le calendrier affiche les mois à venir : un mois déjà passé cette
    année correspond donc à l'année prochaine."""
    return aujourd_hui.year if mois >= aujourd_hui.month else aujourd_hui.year + 1


def _parse_plages(cellule: str, mois: int, aujourd_hui: date) -> list[tuple[date, date]]:
    """'6 au 8' -> une plage ; '9' -> un jour ; plusieurs plages possibles
    par cellule. Gère les plages à cheval sur le mois suivant (ex. '30 au 2')."""
    plages = []
    for m in _RE_PLAGE.finditer(cellule):
        j_debut = int(m.group(1))
        j_fin = int(m.group(2)) if m.group(2) else j_debut
        annee = _annee_pour_mois(mois, aujourd_hui)
        try:
            debut = date(annee, mois, j_debut)
        except ValueError:
            continue
        if j_fin >= j_debut:
            try:
                fin = date(annee, mois, j_fin)
            except ValueError:
                fin = debut
        else:  # la session déborde sur le mois suivant
            mois_fin, annee_fin = (1, annee + 1) if mois == 12 else (mois + 1, annee)
            try:
                fin = date(annee_fin, mois_fin, j_fin)
            except ValueError:
                fin = debut
        plages.append((debut, fin))
    return plages


def _parse_table(table_html: str, aujourd_hui: date) -> list[tuple[date, date]]:
    """Extrait toutes les plages de dates d'un module table (mois en ligne 1)."""
    lignes = _RE_LIGNE.findall(table_html)
    if not lignes:
        return []
    entetes = [_sans_accents(_texte(c)).upper() for c in _RE_CELLULE.findall(lignes[0])]
    colonnes_mois = {i: MOIS[h] for i, h in enumerate(entetes) if h in MOIS}
    if not colonnes_mois:
        return []
    plages = []
    for ligne in lignes[1:]:
        for i, cellule in enumerate(_RE_CELLULE.findall(ligne)):
            if i in colonnes_mois:
                plages.extend(_parse_plages(_texte(cellule),
                                            colonnes_mois[i], aujourd_hui))
    return plages


def _decouvrir_pages_villes(page_accueil: str) -> list[str]:
    """Trouve les pages d'antennes/centres depuis la navigation du site."""
    urls = []
    for href in re.findall(r'<a[^>]+href="([^"]+)"', page_accueil):
        href = urljoin(BASE_URL, html_lib.unescape(href))
        if re.search(r"/accueil/(nos-formations-dans-notre-antenne-de-"
                     r"|calendrier-de-nos-formations-dans-notre-centre-de-)",
                     unquote(href)):
            if href not in urls:
                urls.append(href)
    return urls


def _nom_depuis_texte_precedent(modules: list[tuple[str, str]], idx_table: int) -> str | None:
    """Certains blocs n'ont pas de lien Programme : le nom de la formation est
    alors souvent le dernier paragraphe du module texte juste avant la table."""
    for type_prec, contenu_prec in reversed(modules[max(0, idx_table - 2):idx_table]):
        if type_prec != "text":
            continue
        for paragraphe in reversed(_RE_PARAGRAPHE.findall(contenu_prec)):
            txt = _texte(paragraphe)
            if not txt or len(txt) > 150:
                continue
            minuscule = txt.lower()
            if (minuscule.startswith(("tarif", "programme")) or "cliquez ici" in minuscule
                    or "inscription" in minuscule or "devis" in minuscule):
                continue
            return txt
        return None
    return None


def _parse_page_ville(page_html: str, url_page: str, aujourd_hui: date) -> list[dict]:
    ville = _ville_depuis_url(url_page)
    modules = _modules(page_html)
    sessions = []

    for idx, (type_module, contenu) in enumerate(modules):
        if type_module != "table":
            continue
        plages = _parse_table(contenu, aujourd_hui)
        if not plages:
            continue

        # Le module texte qui suit la table porte le tarif et le lien Programme
        tarif = url_programme = None
        formation = type_formation = None
        for type_suivant, contenu_suivant in modules[idx + 1: idx + 3]:
            if type_suivant != "text":
                continue
            # Le tarif est le texte qui précède le premier lien du module
            m_tarif = _RE_TARIF.search(_texte(contenu_suivant.split("<a", 1)[0]))
            if m_tarif:
                tarif = m_tarif.group(1).strip(" -–") or None
            # Le libellé « Programme » peut être morcelé par des balises
            # (ex. <span>P</span>rogramme) : on compare sans espaces.
            for m in _RE_LIEN.finditer(contenu_suivant):
                libelle = re.sub(r"\s+", "", _texte(m.group(2))).lower()
                if libelle.startswith("programme"):
                    url_programme = urljoin(BASE_URL, html_lib.unescape(m.group(1)))
                    break
            break

        if url_programme:
            p = urlparse(url_programme)
            segments = [s for s in unquote(p.path).split("/") if s]
            if segments:
                formation = _libelle_depuis_slug(segments[-1])
            # La catégorie n'a de sens que pour les URLs du site TEMIS
            if p.netloc.endswith("temis-formation.fr") and len(segments) >= 2:
                type_formation = _libelle_depuis_slug(segments[0])
        if not formation:
            formation = _nom_depuis_texte_precedent(modules, idx)
        if not formation:
            # Pas de lien Programme ni de titre texte : le nom n'existe que
            # dans l'image du bloc.
            formation = "Formation non identifiée (voir page source)"

        for debut, fin in plages:
            sessions.append({
                "organisme": ORGANISME,
                "formation": formation,
                "type_formation": type_formation,
                "ville": ville,
                "date_debut": debut.isoformat(),
                "date_fin": fin.isoformat(),
                "duree_jours": (fin - debut).days + 1,
                "tarif": tarif,
                "url_programme": url_programme,
                "source_url": url_page,
            })
    return sessions


def scrape() -> list[dict]:
    """Point d'entrée : retourne toutes les sessions trouvées sur le site."""
    aujourd_hui = date.today()
    pages = _decouvrir_pages_villes(_fetch(BASE_URL))
    if not pages:
        raise RuntimeError("Aucune page d'antenne trouvée : la structure du site a changé ?")

    sessions = []
    for url in pages:
        time.sleep(DELAY_BETWEEN_PAGES)
        sessions.extend(_parse_page_ville(_fetch(url), url, aujourd_hui))
    return sessions
