"""Filtres de la liste des sessions : validation des paramètres GET,
construction du WHERE 100 % paramétré, tri whitelisté, URLs.

Toutes les URLs du site (pagination, en-têtes de tri, exports, retour
admin) passent par url_liste() pour rester cohérentes entre elles.
"""

import re
from datetime import date
from urllib.parse import urlencode

from . import config

# Colonne de tri -> expression SQL (whitelist stricte : le paramètre `tri`
# n'entre jamais dans le SQL, seule l'expression whitelistée y entre)
TRIS = {
    "date": "date_debut IS NULL, date_debut",
    "formation": "formation COLLATE NOCASE",
    "organisme": "organisme COLLATE NOCASE",
    "ville": "ville COLLATE NOCASE",
    "duree": "duree_jours IS NULL, duree_jours",
    "domaine": "domaine COLLATE NOCASE",
    "tarif": "tarif IS NULL, tarif",
}
TRI_DEFAUT = "date"


def _premier(query: dict, nom: str, defaut: str = "") -> str:
    valeurs = query.get(nom, [])
    return valeurs[0].strip() if valeurs else defaut


def _date_valide(texte: str) -> str | None:
    try:
        return date.fromisoformat(texte).isoformat()
    except ValueError:
        return None


def parser(query: dict) -> dict:
    """Query params (dict de listes, cf. parse_qs) -> filtres validés.

    Le formulaire embarque un champ caché f=1 : sans lui (premier
    affichage), les cases à cocher prennent leurs valeurs par défaut."""
    soumis = _premier(query, "f") == "1"
    f = {
        "domaines": sorted({v.strip() for v in query.get("domaine", []) if v.strip()}),
        "organismes": sorted({v.strip() for v in query.get("organisme", []) if v.strip()}),
        "ville": _premier(query, "ville"),
        "du": _date_valide(_premier(query, "du")) or "",
        "au": _date_valide(_premier(query, "au")) or "",
        "q": _premier(query, "q")[:100],
        "passees": _premier(query, "passees") == "1" if soumis else False,
        "permanentes": _premier(query, "permanentes") == "1" if soumis else True,
        "historique": _premier(query, "historique") == "1" if soumis else False,
    }
    duree = _premier(query, "duree_max").replace(",", ".")
    f["duree_max"] = float(duree) if re.fullmatch(r"\d{1,3}(\.\d+)?", duree) else None

    tri = _premier(query, "tri")
    f["tri"] = tri if tri in TRIS else TRI_DEFAUT
    f["ordre"] = "desc" if _premier(query, "ordre") == "desc" else "asc"
    try:
        f["page"] = max(1, min(int(_premier(query, "page", "1")), 10000))
    except ValueError:
        f["page"] = 1
    return f


def _echapper_like(texte: str) -> str:
    return re.sub(r"([\\%_])", r"\\\1", texte)


def construire_where(f: dict) -> tuple[str, list]:
    """WHERE paramétré sur la vue sessions_effectives."""
    conditions = ["masquee = 0"]
    params: list = []

    if not f["historique"]:
        # « offre courante » PAR organisme : un scraper en échec un matin ne
        # fait pas disparaître tout son organisme
        conditions.append(
            "last_seen = (SELECT MAX(s2.last_seen) FROM sessions s2"
            "             WHERE s2.organisme = sessions_effectives.organisme)")

    for champ, valeurs in (("domaine", f["domaines"]), ("organisme", f["organismes"])):
        if valeurs:
            marques = ",".join("?" * len(valeurs))
            conditions.append(f"{champ} IN ({marques})")
            params.extend(valeurs)

    if f["ville"]:
        conditions.append("ville = ?")
        params.append(f["ville"])

    # Conditions sur les sessions datées ; les permanentes (dates NULL)
    # sont incluses ou non selon leur case à cocher
    datees = []
    if not f["passees"]:
        datees.append("date_fin >= date('now', 'localtime')")
    if f["du"]:
        datees.append("date_debut >= ?")
    if f["au"]:
        datees.append("date_debut <= ?")
    params_datees = [v for v in (f["du"], f["au"]) if v]

    if datees:
        bloc = " AND ".join(datees)
        if f["permanentes"]:
            conditions.append(f"(date_debut IS NULL OR ({bloc}))")
        else:
            conditions.append(f"date_debut IS NOT NULL AND ({bloc})")
        params.extend(params_datees)
    elif not f["permanentes"]:
        conditions.append("date_debut IS NOT NULL")

    if f["duree_max"] is not None:
        conditions.append("(duree_jours <= ? OR duree_jours IS NULL)")
        params.append(f["duree_max"])

    if f["q"]:
        motif = f"%{_echapper_like(f['q'])}%"
        colonnes = ["formation", "type_formation", "organisme", "ville", "remarque"]
        bloc = " OR ".join(f"{c} LIKE ? ESCAPE '\\'" for c in colonnes)
        conditions.append(f"({bloc})")
        params.extend([motif] * len(colonnes))

    return " AND ".join(conditions), params


def clause_tri(f: dict) -> str:
    sens = "DESC" if f["ordre"] == "desc" else "ASC"
    return f"ORDER BY {TRIS[f['tri']]} {sens}, id"


def url_liste(f: dict, base: str = "/", **surcharges) -> str:
    """Reconstruit l'URL de la liste depuis les filtres, en omettant les
    valeurs par défaut. surcharges : page=3, tri="ville", ordre="desc"…"""
    f = {**f, **surcharges}
    params: list[tuple[str, str]] = [("f", "1")]
    for v in f["domaines"]:
        params.append(("domaine", v))
    for v in f["organismes"]:
        params.append(("organisme", v))
    for nom in ("ville", "du", "au", "q"):
        if f[nom]:
            params.append((nom, f[nom]))
    if f["duree_max"] is not None:
        params.append(("duree_max", str(f["duree_max"])))
    if f["passees"]:
        params.append(("passees", "1"))
    if f["permanentes"]:
        params.append(("permanentes", "1"))
    if f["historique"]:
        params.append(("historique", "1"))
    if f["tri"] != TRI_DEFAUT or f["ordre"] != "asc":
        params.append(("tri", f["tri"]))
        params.append(("ordre", f["ordre"]))
    if f.get("page", 1) > 1:
        params.append(("page", str(f["page"])))
    chaine = urlencode(params)
    return f"{base}?{chaine}" if chaine else base


def requete_sessions(conn, f: dict, pagine: bool = True):
    """Exécute la requête filtrée. Retourne (lignes, total)."""
    where, params = construire_where(f)
    total = conn.execute(
        f"SELECT COUNT(*) FROM sessions_effectives WHERE {where}", params).fetchone()[0]
    sql = f"SELECT * FROM sessions_effectives WHERE {where} {clause_tri(f)}"
    if pagine:
        sql += " LIMIT ? OFFSET ?"
        params = params + [config.PAR_PAGE, (f["page"] - 1) * config.PAR_PAGE]
    return conn.execute(sql, params).fetchall(), total
