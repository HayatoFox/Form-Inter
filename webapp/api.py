"""API JSON en lecture seule : expose le catalogue au site Next.js.

Le site de consultation (Form-inter-site) sait se brancher sur cette API pour
rapatrier les sessions ; c'est le mode à utiliser dès que les deux ne tournent
pas sur la même machine (l'autre mode lit directement data/formations.db).

Sécurité : ces routes ne passent pas par le cookie de session du site interne
mais par un jeton porteur, `WEBAPP_API_TOKEN`. **Tant que ce jeton n'est pas
défini, l'API est fermée** (503) : rien ne s'ouvre par accident sur une
installation existante. Le jeton se compare en temps constant.

Endpoints :
    GET /api/sante              — état du service (test de liaison)
    GET /api/sessions           — catalogue paginé

Paramètres de /api/sessions :
    page      (défaut 1)
    par_page  (défaut 500, max 5000)
    passees=1 inclut les sessions déjà terminées
    depuis=AAAA-MM-JJ ne renvoie que les sessions vues à cette date ou après
              (last_seen >= depuis), pour un rafraîchissement incrémental
"""

import hmac
import json
import os
from datetime import date

from . import scrape_ctl
from .app import Reponse

# Colonnes publiées : le schéma à plat de la vue sessions_effectives, moins les
# champs internes (id volatil, masquee, note interne du back office).
COLONNES = [
    "organisme", "formation", "type_formation", "domaine", "ville",
    "date_debut", "date_fin", "duree_jours", "tarif", "remarque",
    "disponibilite", "url_programme", "source_url", "first_seen", "last_seen",
]

PAR_PAGE_DEFAUT = 500
PAR_PAGE_MAX = 5000

# « Offre courante » : dernier passage du scraper, corrélé PAR organisme — un
# scraper en échec un matin ne fait pas disparaître son organisme.
_OFFRE_COURANTE = """last_seen = (SELECT MAX(s2.last_seen) FROM sessions s2
                                  WHERE s2.organisme = sessions_effectives.organisme)"""


def jeton_attendu() -> str | None:
    jeton = os.environ.get("WEBAPP_API_TOKEN", "").strip()
    return jeton or None


def json_reponse(donnees: dict, statut: int = 200) -> Reponse:
    corps = json.dumps(donnees, ensure_ascii=False).encode("utf-8")
    return Reponse(statut, corps,
                   [("Content-Type", "application/json; charset=utf-8"),
                    ("Cache-Control", "no-store")])


def verifier_jeton(req) -> Reponse | None:
    """None si la requête est autorisée, sinon la réponse d'erreur à renvoyer."""
    attendu = jeton_attendu()
    if attendu is None:
        return json_reponse(
            {"error": "API désactivée : définissez WEBAPP_API_TOKEN"}, 503)
    entete = req.handler.headers.get("Authorization", "")
    prefixe = "Bearer "
    fourni = entete[len(prefixe):] if entete.startswith(prefixe) else ""
    if not hmac.compare_digest(fourni, attendu):
        return json_reponse({"error": "Jeton invalide ou absent"}, 401)
    return None


def _entier(query: dict, nom: str, defaut: int, mini: int, maxi: int) -> int:
    try:
        valeur = int(query.get(nom, [""])[0])
    except (ValueError, IndexError):
        return defaut
    return max(mini, min(valeur, maxi))


def _date_valide(texte: str) -> str | None:
    try:
        return date.fromisoformat(texte).isoformat()
    except ValueError:
        return None


# --- Vues --------------------------------------------------------------------

def vue_sante(req):
    refus = verifier_jeton(req)
    if refus:
        return refus
    ligne = req.conn.execute(
        """SELECT COUNT(*) AS sessions,
                  COUNT(DISTINCT organisme) AS organismes,
                  MAX(last_seen) AS dernier_scrape
           FROM sessions""").fetchone()
    # Signalé au site pour qu'il ne rapatrie pas un catalogue à moitié écrit :
    # pendant un passage, les organismes pas encore scrapés n'ont aucune ligne
    # courante, et une synchronisation à cet instant amputerait le site jusqu'au
    # rafraîchissement suivant.
    return json_reponse({
        "service": "Form-Inter backend",
        "version": 1,
        "sessions": ligne["sessions"],
        "organismes": ligne["organismes"],
        "dernier_scrape": ligne["dernier_scrape"],
        "scrape_en_cours": scrape_ctl.scrape_en_cours() is not None,
    })


def vue_sessions(req):
    refus = verifier_jeton(req)
    if refus:
        return refus

    page = _entier(req.query, "page", 1, 1, 100_000)
    par_page = _entier(req.query, "par_page", PAR_PAGE_DEFAUT, 1, PAR_PAGE_MAX)
    passees = req.query.get("passees", [""])[0] == "1"
    depuis = _date_valide(req.query.get("depuis", [""])[0])

    conditions = ["masquee = 0", _OFFRE_COURANTE]
    params: list = []
    if not passees:
        # Une session sans dates est une offre à entrée/sortie permanente :
        # elle ne se périme jamais.
        conditions.append(
            "(date_debut IS NULL OR COALESCE(date_fin, date_debut) >= ?)")
        params.append(date.today().isoformat())
    if depuis:
        conditions.append("last_seen >= ?")
        params.append(depuis)

    where = " AND ".join(conditions)
    total = req.conn.execute(
        f"SELECT COUNT(*) FROM sessions_effectives WHERE {where}",
        params).fetchone()[0]

    colonnes = ", ".join(COLONNES)
    lignes = req.conn.execute(
        f"""SELECT {colonnes} FROM sessions_effectives WHERE {where}
            ORDER BY organisme, formation, date_debut IS NULL, date_debut, id
            LIMIT ? OFFSET ?""",
        params + [par_page, (page - 1) * par_page]).fetchall()

    return json_reponse({
        "sessions": [dict(ligne) for ligne in lignes],
        "page": page,
        "par_page": par_page,
        "total": total,
        "pages": max(1, -(-total // par_page)),
    })
