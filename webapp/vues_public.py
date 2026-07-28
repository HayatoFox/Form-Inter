"""Vues accessibles à tout utilisateur connecté : liste, exports, connexion."""

import mimetypes
import time
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote

from . import auth, config, exports, filtres
from .app import Reponse
from .rendu import badge_domaine, champ_cache, e, lien_externe, page

_STATIC_DIR = Path(__file__).resolve().parent / "static"


# --- Connexion ---------------------------------------------------------------

def vue_connexion(req):
    if req.utilisateur:
        return Reponse.redirection("/")
    suite = req.query.get("suite", ["/"])[0]
    contenu = f"""
<div class="carte carte-connexion">
  <h1>Connexion</h1>
  <form method="post" action="/connexion">
    {champ_cache("suite", suite)}
    <label>Identifiant<br><input type="text" name="identifiant" required autofocus></label>
    <label>Mot de passe<br><input type="password" name="mdp" required></label>
    <button type="submit" class="btn">Se connecter</button>
  </form>
</div>"""
    return Reponse.html(page(req, "Connexion", contenu))


def vue_connexion_post(req):
    identifiant = req.form.get("identifiant", [""])[0].strip()
    mdp = req.form.get("mdp", [""])[0]
    suite = req.form.get("suite", ["/"])[0]
    if not (suite.startswith("/") and not suite.startswith("//")):
        suite = "/"
    utilisateur = req.conn.execute(
        "SELECT * FROM utilisateurs WHERE identifiant = ? AND actif = 1",
        (identifiant,)).fetchone()
    if not utilisateur or not auth.verifier_mdp(mdp, utilisateur["mdp_hash"]):
        time.sleep(0.5)  # freine les tentatives en rafale
        return Reponse.redirection("/connexion?msg=identifiants")
    with req.conn:
        req.conn.execute("UPDATE utilisateurs SET dernier_acces = ? WHERE id = ?",
                         (datetime.now().isoformat(timespec="seconds"),
                          utilisateur["id"]))
    reponse = Reponse.redirection(suite)
    reponse.poser_cookie(auth.creer_cookie(utilisateur["id"]))
    return reponse


def vue_deconnexion(req):
    reponse = Reponse.redirection("/connexion?msg=deconnecte")
    reponse.poser_cookie("", max_age=0)
    return reponse


# --- Liste des sessions ------------------------------------------------------

def _date_fr(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        return date.fromisoformat(iso).strftime("%d/%m/%Y")
    except ValueError:
        return iso


def _options(valeurs, selectionnees) -> str:
    lignes = []
    for v in valeurs:
        sel = " selected" if v in selectionnees else ""
        lignes.append(f'<option value="{e(v)}"{sel}>{e(v)}</option>')
    return "".join(lignes)


def _formulaire_filtres(req, f) -> str:
    conn = req.conn
    domaines = [r[0] for r in conn.execute(
        "SELECT DISTINCT domaine FROM sessions_effectives WHERE domaine IS NOT NULL ORDER BY domaine")]
    organismes = [r[0] for r in conn.execute(
        "SELECT DISTINCT organisme FROM sessions_effectives ORDER BY organisme")]
    villes = [r[0] for r in conn.execute(
        "SELECT DISTINCT ville FROM sessions_effectives WHERE ville IS NOT NULL AND ville != '' ORDER BY ville")]

    def coche(nom):
        return " checked" if f[nom] else ""

    option_villes = _options(villes, [f["ville"]])
    duree = "" if f["duree_max"] is None else e(f["duree_max"])
    return f"""
<form method="get" action="/" class="filtres">
  <input type="hidden" name="f" value="1">
  <div class="filtres-grille">
    <label>Domaine
      <select name="domaine" multiple size="5" title="Ctrl+clic pour une sélection multiple">
        {_options(domaines, f["domaines"])}
      </select></label>
    <label>Organisme
      <select name="organisme" multiple size="5" title="Ctrl+clic pour une sélection multiple">
        {_options(organismes, f["organismes"])}
      </select></label>
    <label>Ville
      <select name="ville"><option value="">Toutes</option>{option_villes}</select></label>
    <div class="filtres-col">
      <label>Du <input type="date" name="du" value="{e(f["du"])}"></label>
      <label>Au <input type="date" name="au" value="{e(f["au"])}"></label>
      <label>Durée max (jours) <input type="number" name="duree_max" min="0.5" step="0.5" value="{duree}"></label>
    </div>
    <div class="filtres-col">
      <label>Recherche <input type="text" name="q" value="{e(f["q"])}" placeholder="intitulé, remarque…"></label>
      <label class="case"><input type="checkbox" name="permanentes" value="1"{coche("permanentes")}> Entrées permanentes</label>
      <label class="case"><input type="checkbox" name="passees" value="1"{coche("passees")}> Sessions passées</label>
      <label class="case" title="Inclure les sessions qui ne sont plus affichées par les sites sources"><input type="checkbox" name="historique" value="1"{coche("historique")}> Historique complet</label>
    </div>
  </div>
  <div class="filtres-actions">
    <button type="submit" class="btn">Filtrer</button>
    <a class="btn btn-secondaire" href="/">Réinitialiser</a>
  </div>
</form>"""


def _entete_tri(f, cle: str, libelle: str) -> str:
    ordre = "asc"
    fleche = ""
    if f["tri"] == cle:
        if f["ordre"] == "asc":
            ordre, fleche = "desc", " ▲"
        else:
            ordre, fleche = "asc", " ▼"
    url = filtres.url_liste(f, tri=cle, ordre=ordre, page=1)
    return f'<th><a href="{e(url)}">{e(libelle)}{fleche}</a></th>'


def _ligne_session(req, s, url_retour: str) -> str:
    if s["date_debut"]:
        debut, fin = _date_fr(s["date_debut"]), _date_fr(s["date_fin"])
        duree = f'{s["duree_jours"]:g} j' if s["duree_jours"] is not None else ""
    else:
        debut, fin, duree = '<span class="permanente">permanente</span>', "", ""
    infos = []
    if s["remarque"]:
        infos.append(f'<span class="info" title="{e(s["remarque"])}">ℹ</span>')
    if s["note_interne"]:
        infos.append(f'<span class="note" title="Note interne : {e(s["note_interne"])}">✎</span>')
    if s["disponibilite"] and "dernières" in s["disponibilite"].lower():
        infos.append(f'<span class="dispo-alerte" title="{e(s["disponibilite"])}">⚠</span>')
    lien_prog = lien_externe(s["url_programme"] or s["source_url"], "fiche")
    modifier = ""
    if req.utilisateur and req.utilisateur["admin"]:
        modifier = (f' <a class="lien-edition" title="Corriger cette session"'
                    f' href="/admin/edition?id={s["id"]}&amp;retour={quote(url_retour, safe="")}">✎</a>')
    return f"""<tr>
<td>{badge_domaine(s["domaine"])}</td>
<td class="col-formation">{e(s["formation"])} {"".join(infos)}</td>
<td>{e(s["organisme"])}</td>
<td>{e(s["ville"])}</td>
<td class="col-date">{debut}</td>
<td class="col-date">{fin}</td>
<td class="col-num">{duree}</td>
<td class="col-tarif">{e(s["tarif"])}</td>
<td>{lien_prog}{modifier}</td>
</tr>"""


def vue_liste(req):
    f = filtres.parser(req.query)
    lignes, total = filtres.requete_sessions(req.conn, f)
    nb_pages = max(1, -(-total // config.PAR_PAGE))
    if f["page"] > nb_pages:
        f["page"] = nb_pages

    url_actuelle = filtres.url_liste(f)
    corps_tableau = "".join(_ligne_session(req, s, url_actuelle) for s in lignes)
    if not lignes:
        corps_tableau = '<tr><td colspan="9" class="vide">Aucune session ne correspond à ces filtres.</td></tr>'

    entetes = (_entete_tri(f, "domaine", "Domaine")
               + _entete_tri(f, "formation", "Formation")
               + _entete_tri(f, "organisme", "Organisme")
               + _entete_tri(f, "ville", "Ville")
               + _entete_tri(f, "date", "Début")
               + "<th>Fin</th>"
               + _entete_tri(f, "duree", "Durée")
               + _entete_tri(f, "tarif", "Tarif")
               + "<th></th>")

    pagination = []
    if f["page"] > 1:
        pagination.append(f'<a class="btn btn-secondaire" href="{e(filtres.url_liste(f, page=f["page"]-1))}">&larr; Précédent</a>')
    pagination.append(f'<span class="page-info">page {f["page"]}/{nb_pages}</span>')
    if f["page"] < nb_pages:
        pagination.append(f'<a class="btn btn-secondaire" href="{e(filtres.url_liste(f, page=f["page"]+1))}">Suivant &rarr;</a>')

    url_csv = e(filtres.url_liste(f, base="/export.csv", page=1))
    url_xlsx = e(filtres.url_liste(f, base="/export.xlsx", page=1))

    total_fr = f"{total:,}".replace(",", " ")
    contenu = f"""
<h1>Sessions de formation <span class="compteur">{total_fr}</span></h1>
{_formulaire_filtres(req, f)}
<div class="barre-resultats">
  <span>{total_fr} session(s)</span>
  <span class="exports">Exporter : <a href="{url_csv}">CSV</a> · <a href="{url_xlsx}">Excel</a></span>
</div>
<div class="conteneur-tableau">
<table class="sessions">
  <thead><tr>{entetes}</tr></thead>
  <tbody>{corps_tableau}</tbody>
</table>
</div>
<div class="pagination">{"".join(pagination)}</div>
"""
    return Reponse.html(page(req, "Sessions", contenu))


def vue_export_csv(req):
    f = filtres.parser(req.query)
    lignes, _ = filtres.requete_sessions(req.conn, f, pagine=False)
    nom = f"sessions_{date.today().isoformat()}.csv"
    return Reponse.fichier(exports.generer_csv(lignes), "text/csv; charset=utf-8", nom)


def vue_export_xlsx(req):
    f = filtres.parser(req.query)
    lignes, _ = filtres.requete_sessions(req.conn, f, pagine=False)
    nom = f"sessions_{date.today().isoformat()}.xlsx"
    return Reponse.fichier(
        exports.generer_xlsx(lignes),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nom)


# --- Statique ----------------------------------------------------------------

def vue_static(req, fichier: str):
    chemin = _STATIC_DIR / fichier
    if not chemin.is_file():
        return Reponse(404, b"introuvable", [("Content-Type", "text/plain")])
    type_mime = mimetypes.guess_type(fichier)[0] or "application/octet-stream"
    return Reponse(200, chemin.read_bytes(),
                   [("Content-Type", type_mime),
                    ("Cache-Control", "max-age=3600")])
