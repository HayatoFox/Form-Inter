"""Serveur HTTP stdlib : ThreadingHTTPServer + routeur maison.

Chaque requête ouvre sa propre connexion SQLite (les connexions sqlite3 ne
se partagent pas entre threads) et la ferme en fin de traitement.
L'authentification et le CSRF sont appliqués centralement par le routeur :
- accès "public"   : /connexion, /static/*
- accès "connecte" : tout le reste
- accès "admin"    : /admin/*
- tout POST (hors /connexion) exige un jeton CSRF valide.
"""

import re
import sys
import traceback
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlsplit

from . import auth, db


class Reponse:
    def __init__(self, statut=200, corps=b"", entetes=None):
        self.statut = statut
        self.corps = corps
        self.entetes = list(entetes or [])

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
    def __init__(self, handler, chemin, query, form):
        self.handler = handler
        self.methode = handler.command
        self.chemin = chemin
        self.query = query          # dict[str, list[str]]
        self.form = form            # dict[str, list[str]]
        self.conn = None
        self.utilisateur = None
        cookies = SimpleCookie(handler.headers.get("Cookie", ""))
        morceau = cookies.get(auth.COOKIE_NOM)
        self.cookie_session = morceau.value if morceau else None

    @property
    def csrf(self) -> str:
        return auth.jeton_csrf(self.cookie_session)


def _page_erreur(req, statut: int, titre: str, texte: str) -> Reponse:
    from .rendu import e, page
    contenu = f'<div class="carte"><h1>{e(titre)}</h1><p>{e(texte)}</p><p><a href="/">Retour aux sessions</a></p></div>'
    return Reponse.html(page(req, titre, contenu), statut)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ProinsecFormations/1"

    def log_message(self, format, *args):  # journal d'accès silencieux
        pass

    def do_GET(self):
        self._traiter("GET")

    def do_POST(self):
        self._traiter("POST")

    def _lire_form(self) -> dict:
        try:
            longueur = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return {}
        if not 0 < longueur <= 1_000_000:
            return {}
        corps = self.rfile.read(longueur).decode("utf-8", errors="replace")
        return parse_qs(corps, keep_blank_values=True)

    def _traiter(self, methode: str) -> None:
        morceaux = urlsplit(self.path)
        chemin = morceaux.path
        query = parse_qs(morceaux.query, keep_blank_values=True)
        form = self._lire_form() if methode == "POST" else {}
        req = Requete(self, chemin, query, form)

        try:
            req.conn = db.connexion()
            reponse = self._router(req, methode, chemin)
        except BrokenPipeError:
            return
        except Exception:
            traceback.print_exc(file=sys.stderr)
            reponse = _page_erreur(req, 500, "Erreur interne",
                                   "Une erreur inattendue s'est produite.")
        finally:
            if req.conn is not None:
                req.conn.close()
        self._envoyer(reponse)

    def _router(self, req: Requete, methode: str, chemin: str) -> Reponse:
        correspondance_chemin = False
        for route_methode, motif, vue, acces in ROUTES:
            m = motif.fullmatch(chemin)
            if not m:
                continue
            correspondance_chemin = True
            if route_methode != methode:
                continue

            # L'accès "api" ne passe pas par le cookie de session : la vue
            # vérifie elle-même le jeton porteur (webapp/api.py).
            if acces not in ("public", "api"):
                req.utilisateur = auth.utilisateur_depuis_cookie(
                    req.conn, req.cookie_session)
                if req.utilisateur is None:
                    suite = quote(req.handler.path, safe="/?&=%")
                    return Reponse.redirection(f"/connexion?suite={quote(suite, safe='')}")
                if acces == "admin" and not req.utilisateur["admin"]:
                    return _page_erreur(req, 403, "Accès refusé",
                                        "Cette page est réservée aux administrateurs.")
            if methode == "POST" and chemin != "/connexion":
                jeton = req.form.get("csrf", [""])[0]
                if not auth.verifier_csrf(req.cookie_session, jeton):
                    return _page_erreur(req, 403, "Session expirée",
                                        "Jeton de sécurité invalide — retournez en arrière et réessayez.")
            return vue(req, **m.groupdict())

        if chemin.startswith("/api/"):
            from .api import json_reponse
            return json_reponse(
                {"error": "Méthode non autorisée" if correspondance_chemin
                          else "Endpoint inconnu"},
                405 if correspondance_chemin else 404)
        if correspondance_chemin:
            return Reponse(405, b"Methode non autorisee",
                           [("Content-Type", "text/plain; charset=utf-8")])
        return _page_erreur(req, 404, "Page introuvable",
                            "Cette adresse ne correspond à aucune page.")

    def _envoyer(self, reponse: Reponse) -> None:
        try:
            self.send_response(reponse.statut)
            for nom, valeur in reponse.entetes:
                self.send_header(nom, valeur)
            self.send_header("Content-Length", str(len(reponse.corps)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(reponse.corps)
        except BrokenPipeError:
            pass


def creer_serveur(port: int) -> ThreadingHTTPServer:
    conn = db.connexion()
    auth.bootstrap_admin(conn)
    conn.close()
    return ThreadingHTTPServer(("0.0.0.0", port), Handler)


# --- Table de routage (importée en fin de module : les vues importent Reponse)
from . import api, vues_admin, vues_public  # noqa: E402

ROUTES = [
    ("GET", re.compile(r"/api/sante"), api.vue_sante, "api"),
    ("GET", re.compile(r"/api/sessions"), api.vue_sessions, "api"),
    ("GET", re.compile(r"/connexion"), vues_public.vue_connexion, "public"),
    ("POST", re.compile(r"/connexion"), vues_public.vue_connexion_post, "public"),
    ("GET", re.compile(r"/static/(?P<fichier>[A-Za-z0-9._-]+)"), vues_public.vue_static, "public"),
    ("POST", re.compile(r"/deconnexion"), vues_public.vue_deconnexion, "connecte"),
    ("GET", re.compile(r"/"), vues_public.vue_liste, "connecte"),
    ("GET", re.compile(r"/export\.csv"), vues_public.vue_export_csv, "connecte"),
    ("GET", re.compile(r"/export\.xlsx"), vues_public.vue_export_xlsx, "connecte"),
    ("GET", re.compile(r"/admin"), vues_admin.vue_tableau_de_bord, "admin"),
    ("GET", re.compile(r"/admin/edition"), vues_admin.vue_edition, "admin"),
    ("POST", re.compile(r"/admin/edition"), vues_admin.vue_edition_post, "admin"),
    ("GET", re.compile(r"/admin/overrides"), vues_admin.vue_overrides, "admin"),
    ("POST", re.compile(r"/admin/overrides/supprimer"), vues_admin.vue_overrides_supprimer, "admin"),
    ("POST", re.compile(r"/admin/scrape"), vues_admin.vue_scrape_post, "admin"),
    ("GET", re.compile(r"/admin/stats"), vues_admin.vue_stats, "admin"),
    ("GET", re.compile(r"/admin/utilisateurs"), vues_admin.vue_utilisateurs, "admin"),
    ("POST", re.compile(r"/admin/utilisateurs"), vues_admin.vue_utilisateurs_post, "admin"),
]
