"""Service des fichiers de l'interface (build Vite de `frontend/`).

Le build est produit dans `webapp/static/app/` et **commité** : le serveur
Python reste ainsi lançable tel quel, sans Node ni étape de construction,
comme le reste du projet. `npm --prefix frontend run build` le régénère.

Deux régimes de cache :
- `assets/…` : noms hashés par Vite → cache immuable d'un an ;
- `index.html` : jamais mis en cache, pour que le déploiement d'un nouveau
  build soit pris en compte au rechargement suivant.
"""

import base64
import hashlib
import mimetypes
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent / "static" / "app"
_INDEX = RACINE / "index.html"

_SCRIPT_INLINE = re.compile(rb"<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>", re.S | re.I)

_CACHE_IMMUABLE = "public, max-age=31536000, immutable"
_SANS_CACHE = "no-cache, no-store, must-revalidate"

_ABSENT = b"""<!DOCTYPE html><html lang="fr"><meta charset="utf-8">
<title>Interface non construite</title>
<body style="font:15px/1.6 system-ui;max-width:40rem;margin:12vh auto;padding:0 1.5rem">
<h1>Interface non construite</h1>
<p>Les fichiers de l'interface sont absents de <code>webapp/static/app/</code>.</p>
<p>Construisez-la puis rechargez cette page :</p>
<pre style="background:#f3f4f6;padding:1rem;border-radius:.5rem">npm --prefix frontend install
npm --prefix frontend run build</pre>
<p>L'API reste disponible sous <code>/api/</code>.</p>
</body></html>"""


def build_present() -> bool:
    return _INDEX.is_file()


def hachages_scripts_inline() -> list[str]:
    """Empreintes sha256 des scripts inline d'index.html, pour la CSP.

    Le build en contient un seul : l'application du thème clair/sombre avant
    le premier rendu (sans lui, la page « flashe » en blanc). Plutôt que
    d'autoriser 'unsafe-inline', on autorise exactement ce script — et le
    calcul étant fait depuis le fichier, il reste juste après chaque build.
    """
    if not build_present():
        return []
    return [
        "'sha256-" + base64.b64encode(hashlib.sha256(corps).digest()).decode() + "'"
        for corps in _SCRIPT_INLINE.findall(_INDEX.read_bytes())
    ]


def _dans_racine(chemin: Path) -> bool:
    """Garde-fou contre les remontées de chemin (« ../../etc/passwd »)."""
    try:
        return chemin.resolve().is_relative_to(RACINE)
    except (OSError, ValueError):
        return False


def servir(chemin_url: str):
    """Fichier du build correspondant à l'URL, sinon index.html.

    Le repli sur index.html est ce qui permet à /sessions, /admin/stats… de
    répondre 200 sur un rechargement : c'est le routeur du navigateur qui
    affiche ensuite la bonne page."""
    from .app import Reponse

    if not build_present():
        return Reponse(503, _ABSENT, [("Content-Type", "text/html; charset=utf-8"),
                                      ("Cache-Control", _SANS_CACHE)])

    relatif = chemin_url.lstrip("/")
    if relatif:
        fichier = RACINE / relatif
        if fichier.is_file() and _dans_racine(fichier):
            type_mime = mimetypes.guess_type(fichier.name)[0] or "application/octet-stream"
            if type_mime.startswith("text/") or type_mime in (
                    "application/javascript", "application/json", "image/svg+xml"):
                type_mime += "; charset=utf-8"
            cache = _CACHE_IMMUABLE if relatif.startswith("assets/") else _SANS_CACHE
            return Reponse(200, fichier.read_bytes(),
                           [("Content-Type", type_mime), ("Cache-Control", cache)])

    return Reponse(200, _INDEX.read_bytes(),
                   [("Content-Type", "text/html; charset=utf-8"),
                    ("Cache-Control", _SANS_CACHE)])
