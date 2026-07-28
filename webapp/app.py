"""Serveur HTTP stdlib : ThreadingHTTPServer + routeur maison.

Deux familles de routes :
- `/api/*` : l'API JSON (`api.py`) consommée par l'interface React ;
- tout le reste : les fichiers du build Vite, avec repli sur index.html
  (le routage des pages est fait côté navigateur).

Chaque requête ouvre sa propre connexion SQLite (les connexions sqlite3 ne
se partagent pas entre threads) et la ferme en fin de traitement.
L'authentification et le CSRF sont appliqués centralement par le routeur :
- accès "public"   : /api/connexion, /api/moi, les fichiers statiques
- accès "connecte" : tout le reste de l'API
- accès "admin"    : /api/admin/*
- toute méthode d'écriture (POST/PUT/DELETE) hors /api/connexion exige un
  jeton CSRF valide, transmis dans l'en-tête X-CSRF-Token.
"""

import json
import re
import sys
import traceback
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlsplit

from . import auth, db, statiques

ENTETE_CSRF = "X-CSRF-Token"
_METHODES_ECRITURE = ("POST", "PUT", "DELETE")

# L'interface est entièrement servie depuis l'origine : rien d'externe à
# autoriser. 'unsafe-inline' sur les styles couvre les styles inline de React ;
# les scripts, eux, sont autorisés un par un par leur empreinte (cf.
# statiques.hachages_scripts_inline).
def _construire_csp() -> str:
    scripts = " ".join(["'self'", *statiques.hachages_scripts_inline()])
    return ("default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            f"script-src {scripts}; connect-src 'self'; font-src 'self' data:; "
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'")


_CSP = _construire_csp()


class Reponse:
    def __init__(self, statut=200, corps=b"", entetes=None):
        self.statut = statut
        self.corps = corps
        self.entetes = list(entetes or [])

    @classmethod
    def json(cls, donnees, statut: int = 200) -> "Reponse":
        corps = json.dumps(donnees, ensure_ascii=False, default=str).encode("utf-8")
        return cls(statut, corps, [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Cache-Control", "no-store")])

    @classmethod
    def html(cls, contenu: str, statut: int = 200) -> "Reponse":
        return cls(statut, contenu.encode("utf-8"),
                   [("Content-Type", "text/html; charset=utf-8")])

    @classmethod
    def redirection(cls, url: str) -> "Reponse":
        if not (url.startswith("/") and not url.startswith("//")):
            url = "/"
        return cls(303, b"", [("Location", url)])

    @classmethod
    def fichier(cls, donnees: bytes, type_mime: str, nom: str) -> "Reponse":
        return cls(200, donnees, [
            ("Content-Type", type_mime),
            ("Content-Disposition", f'attachment; filename="{quote(nom)}"')])

    def poser_cookie(self, valeur: str, max_age: int | None = None) -> None:
        from . import config
        if max_age is None:
            max_age = config.DUREE_SESSION_S
        self.entetes.append((
            "Set-Cookie",
            f"{auth.COOKIE_NOM}={valeur}; Max-Age={max_age}; Path=/; "
            f"HttpOnly; SameSite=Lax"))


class Requete:
    def __init__(self, handler, chemin, query, corps: bytes):
        self.handler = handler
        self.methode = handler.command
        self.chemin = chemin
        self.query = query          # dict[str, list[str]]
        self.corps = corps
        self.conn = None
        self.utilisateur = None
        cookies = SimpleCookie(handler.headers.get("Cookie", ""))
        morceau = cookies.get(auth.COOKIE_NOM)
        self.cookie_session = morceau.value if morceau else None

    @property
    def json(self) -> dict:
        """Corps JSON de la requête ; {} si absent ou illisible."""
        if not self.corps:
            return {}
        try:
            donnees = json.loads(self.corps.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}
        return donnees if isinstance(donnees, dict) else {}

    @property
    def csrf(self) -> str:
        return auth.jeton_csrf(self.cookie_session)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ProinsecFormations/2"

    def log_message(self, format, *args):  # journal d'accès silencieux
        pass

    def do_GET(self):
        self._traiter("GET")

    def do_POST(self):
        self._traiter("POST")

    def do_PUT(self):
        self._traiter("PUT")

    def do_DELETE(self):
        self._traiter("DELETE")

    def _lire_corps(self) -> bytes:
        try:
            longueur = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return b""
        if not 0 < longueur <= 1_000_000:
            return b""
        return self.rfile.read(longueur)

    def _traiter(self, methode: str) -> None:
        morceaux = urlsplit(self.path)
        chemin = morceaux.path
        query = parse_qs(morceaux.query, keep_blank_values=True)
        corps = self._lire_corps() if methode in _METHODES_ECRITURE else b""
        req = Requete(self, chemin, query, corps)

        try:
            reponse = self._router(req, methode, chemin)
        except BrokenPipeError:
            return
        except Exception:
            traceback.print_exc(file=sys.stderr)
            reponse = Reponse.json({"erreur": "interne"}, 500)
        finally:
            if req.conn is not None:
                req.conn.close()
        self._envoyer(reponse)

    def _router(self, req: Requete, methode: str, chemin: str) -> Reponse:
        if not chemin.startswith("/api/") and chemin not in ("/export.csv", "/export.xlsx"):
            # Tout ce qui n'est pas l'API est l'interface : fichiers du build
            # Vite, avec repli sur index.html pour les routes du navigateur.
            if methode != "GET":
                return Reponse(405, b"", [("Allow", "GET")])
            return statiques.servir(chemin)

        correspondance_chemin = False
        for route_methode, motif, vue, acces in ROUTES:
            m = motif.fullmatch(chemin)
            if not m:
                continue
            correspondance_chemin = True
            if route_methode != methode:
                continue

            req.conn = db.connexion()
            if acces != "public":
                req.utilisateur = auth.utilisateur_depuis_cookie(
                    req.conn, req.cookie_session)
                if req.utilisateur is None:
                    return Reponse.json({"erreur": "non_connecte"}, 401)
                if acces == "admin" and not req.utilisateur["admin"]:
                    return Reponse.json({"erreur": "reserve_admin"}, 403)
            if methode in _METHODES_ECRITURE and chemin != "/api/connexion":
                jeton = req.handler.headers.get(ENTETE_CSRF)
                if not auth.verifier_csrf(req.cookie_session, jeton):
                    return Reponse.json({"erreur": "csrf"}, 403)
            return vue(req, **m.groupdict())

        if correspondance_chemin:
            return Reponse.json({"erreur": "methode"}, 405)
        return Reponse.json({"erreur": "introuvable"}, 404)

    def _envoyer(self, reponse: Reponse) -> None:
        try:
            self.send_response(reponse.statut)
            for nom, valeur in reponse.entetes:
                self.send_header(nom, valeur)
            self.send_header("Content-Length", str(len(reponse.corps)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "same-origin")
            self.send_header("Content-Security-Policy", _CSP)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(reponse.corps)
        except BrokenPipeError:
            pass


def creer_serveur(port: int) -> ThreadingHTTPServer:
    conn = db.connexion()
    auth.bootstrap_admin(conn)
    conn.close()
    if not statiques.build_present():
        print("[webapp] ATTENTION : interface non construite "
              f"({statiques.RACINE}). Lancez `npm --prefix frontend run build`.",
              file=sys.stderr)
    return ThreadingHTTPServer(("0.0.0.0", port), Handler)


# --- Table de routage (importée en fin de module : api.py importe Reponse) ----
from . import api  # noqa: E402

_ID = r"(?P<%s>\d{1,12})"

ROUTES = [
    # Session de travail
    ("GET", re.compile(r"/api/moi"), api.moi, "public"),
    ("POST", re.compile(r"/api/connexion"), api.connexion, "public"),
    ("POST", re.compile(r"/api/deconnexion"), api.deconnexion, "connecte"),
    ("POST", re.compile(r"/api/mot-de-passe"), api.changer_mdp, "connecte"),

    # Sessions de formation
    ("GET", re.compile(r"/api/sessions"), api.liste_sessions, "connecte"),
    ("GET", re.compile(r"/api/sessions/" + _ID % "id_session"), api.detail_session, "connecte"),
    ("GET", re.compile(r"/api/facettes"), api.facettes, "connecte"),
    ("GET", re.compile(r"/api/resume"), api.resume, "connecte"),

    # Vues enregistrées
    ("GET", re.compile(r"/api/vues"), api.liste_vues, "connecte"),
    ("POST", re.compile(r"/api/vues"), api.creer_vue, "connecte"),
    ("DELETE", re.compile(r"/api/vues/" + _ID % "id_vue"), api.supprimer_vue, "connecte"),

    # Back office
    ("GET", re.compile(r"/api/admin/sante"), api.sante, "admin"),
    ("POST", re.compile(r"/api/admin/scrape"), api.lancer_scrape, "admin"),
    ("GET", re.compile(r"/api/admin/stats"), api.stats, "admin"),
    ("GET", re.compile(r"/api/admin/domaines"), api.domaines_connus, "admin"),
    ("GET", re.compile(r"/api/admin/overrides"), api.liste_overrides, "admin"),
    ("POST", re.compile(r"/api/admin/overrides"), api.enregistrer_override, "admin"),
    ("DELETE", re.compile(r"/api/admin/overrides/" + _ID % "id_override"),
     api.supprimer_override, "admin"),
    ("GET", re.compile(r"/api/admin/utilisateurs"), api.liste_utilisateurs, "admin"),
    ("POST", re.compile(r"/api/admin/utilisateurs"), api.creer_utilisateur, "admin"),
    ("POST", re.compile(r"/api/admin/utilisateurs/" + _ID % "id_utilisateur"),
     api.modifier_utilisateur, "admin"),

    # Exports du résultat filtré (téléchargements, hors JSON)
    ("GET", re.compile(r"/export\.csv"), api.export_csv, "connecte"),
    ("GET", re.compile(r"/export\.xlsx"), api.export_xlsx, "connecte"),
]
