"""Rendu HTML : échappement, layout commun, composants réutilisables.

Pas de moteur de templates : un squelette string.Template + des fonctions
Python qui retournent du HTML déjà échappé. Règle absolue : toute valeur
issue de la BDD ou de l'utilisateur passe par e() avant concaténation.
"""

import html
from string import Template

from . import auth

# Domaines -> classe CSS de badge (couleur stable par domaine)
_NB_COULEURS_BADGE = 8


def e(valeur) -> str:
    """html.escape tolérant : None -> chaîne vide."""
    if valeur is None:
        return ""
    return html.escape(str(valeur), quote=True)


def classe_domaine(domaine: str | None) -> str:
    if not domaine:
        return "dom-0"
    return f"dom-{sum(domaine.encode()) % _NB_COULEURS_BADGE}"


def badge_domaine(domaine: str | None) -> str:
    if not domaine:
        return ""
    return f'<span class="badge {classe_domaine(domaine)}">{e(domaine)}</span>'


_PAGE = Template("""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$titre — PROINSEC Formations</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<header class="bandeau">
  <div class="bandeau-int">
    <a class="marque" href="/">PROINSEC <span>· Formations</span></a>
    <nav>$nav</nav>
  </div>
</header>
<main>
$message
$contenu
</main>
<footer>Outil interne PROINSEC — données collectées automatiquement, à recouper avant engagement.</footer>
</body>
</html>""")

# Messages « flash » passés en query param ?msg=<code> (jamais de texte libre)
MESSAGES = {
    "connecte": ("ok", "Connexion réussie."),
    "deconnecte": ("ok", "Vous êtes déconnecté(e)."),
    "identifiants": ("erreur", "Identifiant ou mot de passe incorrect."),
    "enregistre": ("ok", "Modifications enregistrées."),
    "supprime": ("ok", "Élément supprimé."),
    "scrape_lance": ("ok", "Scrape lancé en arrière-plan (compter ~10 minutes)."),
    "scrape_deja": ("erreur", "Un scrape est déjà en cours."),
    "utilisateur_cree": ("ok", "Compte créé."),
    "utilisateur_maj": ("ok", "Compte mis à jour."),
    "dernier_admin": ("erreur", "Impossible : c'est le dernier compte admin actif."),
    "identifiant_pris": ("erreur", "Cet identifiant existe déjà."),
    "champs": ("erreur", "Champs manquants ou invalides."),
    "csrf": ("erreur", "Session expirée, merci de réessayer."),
}


def page(req, titre: str, contenu: str) -> str:
    """Assemble la page complète. `req` porte utilisateur et cookie_session."""
    liens = []
    if req.utilisateur:
        liens.append('<a href="/">Sessions</a>')
        if req.utilisateur["admin"]:
            liens.append('<a href="/admin">Back office</a>')
        csrf = auth.jeton_csrf(req.cookie_session)
        liens.append(
            f'<form method="post" action="/deconnexion" class="nav-form">'
            f'<input type="hidden" name="csrf" value="{e(csrf)}">'
            f'<span class="nav-user">{e(req.utilisateur["identifiant"])}</span>'
            f'<button type="submit" class="lien">Déconnexion</button></form>')

    code = req.query.get("msg", [""])[0]
    message = ""
    if code in MESSAGES:
        genre, texte = MESSAGES[code]
        message = f'<div class="flash flash-{genre}">{e(texte)}</div>'

    return _PAGE.substitute(titre=e(titre), nav=" ".join(liens),
                            message=message, contenu=contenu)


def champ_cache(nom: str, valeur) -> str:
    return f'<input type="hidden" name="{e(nom)}" value="{e(valeur)}">'


def lien_externe(url: str | None, libelle: str) -> str:
    """Lien cliquable seulement si l'URL est http(s)."""
    if not url or not str(url).startswith(("http://", "https://")):
        return ""
    return (f'<a href="{e(url)}" target="_blank" rel="noopener noreferrer">'
            f'{e(libelle)}</a>')
