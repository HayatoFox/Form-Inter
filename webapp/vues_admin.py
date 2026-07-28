"""Back office : santé des scrapers, corrections de sessions (overrides),
statistiques, scrape manuel, gestion des comptes."""

import secrets
from datetime import datetime

from . import auth, config, scrape_ctl
from .app import Reponse
from .rendu import badge_domaine, champ_cache, e, page


def _retour_valide(valeur: str) -> str:
    return valeur if valeur.startswith("/") and not valeur.startswith("//") else "/"


def _nav_admin(actif: str) -> str:
    onglets = [("/admin", "Santé des scrapers"), ("/admin/stats", "Statistiques"),
               ("/admin/overrides", "Corrections"), ("/admin/utilisateurs", "Utilisateurs")]
    liens = []
    for url, libelle in onglets:
        classe = ' class="actif"' if url == actif else ""
        liens.append(f'<a href="{url}"{classe}>{libelle}</a>')
    return f'<nav class="onglets">{"".join(liens)}</nav>'


# --- Tableau de bord : santé des scrapers ------------------------------------

def _sante_organisme(conn, organisme: str) -> dict:
    dernier = conn.execute(
        """SELECT * FROM scrape_runs WHERE organisme = ?
           ORDER BY demarre_le DESC LIMIT 1""", (organisme,)).fetchone()
    precedent_ok = conn.execute(
        """SELECT nb_sessions FROM scrape_runs
           WHERE organisme = ? AND statut = 'ok' AND id != ?
           ORDER BY demarre_le DESC LIMIT 1""",
        (organisme, dernier["id"] if dernier else -1)).fetchone()

    alerte, niveau = "", "ok"
    if dernier is None:
        alerte, niveau = "Jamais scrapé (instrumentation récente)", "alerte"
    elif dernier["statut"] == "erreur":
        alerte, niveau = "Échec du dernier passage", "erreur"
    else:
        age_h = (datetime.now()
                 - datetime.fromisoformat(dernier["demarre_le"])).total_seconds() / 3600
        if age_h > config.SEUIL_CRON_H:
            alerte, niveau = f"Aucun passage depuis {age_h:.0f} h (cron en panne ?)", "erreur"
        elif not dernier["nb_sessions"]:
            alerte, niveau = "0 session trouvée (site source modifié ?)", "alerte"
        elif precedent_ok and precedent_ok["nb_sessions"] \
                and dernier["nb_sessions"] < precedent_ok["nb_sessions"] * config.SEUIL_CHUTE:
            alerte, niveau = (f"Chute : {dernier['nb_sessions']} sessions contre "
                              f"{precedent_ok['nb_sessions']} au passage précédent"), "alerte"
    return {"dernier": dernier, "alerte": alerte, "niveau": niveau}


def vue_tableau_de_bord(req):
    conn = req.conn
    organismes = [r[0] for r in conn.execute(
        """SELECT DISTINCT organisme FROM (
             SELECT organisme FROM sessions UNION SELECT organisme FROM scrape_runs)
           ORDER BY organisme""")]

    lignes = []
    for organisme in organismes:
        s = _sante_organisme(conn, organisme)
        d = s["dernier"]
        if d:
            quand = datetime.fromisoformat(d["demarre_le"]).strftime("%d/%m %H:%M")
            details = (f'{quand} ({e(d["declencheur"])}) — '
                       f'{d["nb_sessions"] if d["nb_sessions"] is not None else "—"} sessions'
                       f' en {d["duree_s"]:.0f} s' if d["duree_s"] is not None else quand)
        else:
            details = "—"
        pastille = f'<span class="pastille pastille-{s["niveau"]}"></span>'
        alerte = f'<span class="texte-{s["niveau"]}">{e(s["alerte"])}</span>' if s["alerte"] else "RAS"
        message = ""
        if d and d["statut"] == "erreur" and d["message"]:
            message = (f'<details><summary>détail de l\'erreur</summary>'
                       f'<pre class="erreur-log">{e(d["message"])}</pre></details>')
        lignes.append(f"<tr><td>{pastille} {e(organisme)}</td>"
                      f"<td>{details}</td><td>{alerte}{message}</td></tr>")

    en_cours = scrape_ctl.scrape_en_cours()
    if en_cours:
        bouton_scrape = (f'<button class="btn" disabled>Scrape en cours depuis {e(en_cours)}…</button>'
                         f'<p class="aide">Rechargez la page pour suivre l\'avancement.</p>')
    else:
        bouton_scrape = (f'<form method="post" action="/admin/scrape">'
                         f'{champ_cache("csrf", req.csrf)}'
                         f'<button type="submit" class="btn">Relancer un scrape maintenant</button>'
                         f'<span class="aide"> (~10 minutes, en arrière-plan)</span></form>')

    historique = conn.execute(
        "SELECT * FROM scrape_runs ORDER BY demarre_le DESC, id DESC LIMIT 25").fetchall()
    lignes_hist = []
    for r in historique:
        quand = datetime.fromisoformat(r["demarre_le"]).strftime("%d/%m %H:%M")
        classe = "ok" if r["statut"] == "ok" else "erreur"
        nb = r["nb_sessions"] if r["nb_sessions"] is not None else "—"
        duree = f"{r['duree_s']:.0f} s" if r["duree_s"] is not None else ""
        lignes_hist.append(
            f"<tr><td>{e(quand)}</td><td>{e(r['organisme'])}</td>"
            f"<td class='texte-{classe}'>{e(r['statut'])}</td>"
            f"<td>{nb}</td><td>{duree}</td><td>{e(r['declencheur'])}</td></tr>")
    lignes_hist = "".join(lignes_hist)

    contenu = f"""
{_nav_admin("/admin")}
<h1>Santé des scrapers</h1>
<div class="carte">{bouton_scrape}</div>
<table class="admin"><thead><tr><th>Organisme</th><th>Dernier passage</th><th>État</th></tr></thead>
<tbody>{"".join(lignes)}</tbody></table>
<details class="carte-details"><summary>25 derniers passages</summary>
<table class="admin"><thead><tr><th>Quand</th><th>Organisme</th><th>Statut</th><th>Sessions</th><th>Durée</th><th>Déclencheur</th></tr></thead>
<tbody>{lignes_hist}</tbody></table></details>
"""
    return Reponse.html(page(req, "Back office", contenu))


def vue_scrape_post(req):
    lance = scrape_ctl.demarrer_scrape()
    return Reponse.redirection("/admin?msg=" + ("scrape_lance" if lance else "scrape_deja"))


# --- Corrections de sessions (overrides) -------------------------------------

def _domaines_connus(conn) -> list[str]:
    from scraper.domaines import REGLES, AUTRE
    connus = [d for d, _ in REGLES] + [AUTRE]
    en_base = [r[0] for r in conn.execute(
        "SELECT DISTINCT domaine FROM sessions WHERE domaine IS NOT NULL")]
    return sorted(set(connus) | set(en_base))


def vue_edition(req):
    try:
        id_session = int(req.query.get("id", [""])[0])
    except ValueError:
        return Reponse.redirection("/")
    retour = _retour_valide(req.query.get("retour", ["/"])[0])
    s = req.conn.execute(
        "SELECT * FROM sessions_effectives WHERE id = ?", (id_session,)).fetchone()
    if not s:
        return Reponse.redirection(retour)

    o = req.conn.execute(
        """SELECT * FROM overrides WHERE organisme = ? AND formation = ?
           AND ville = ? AND date_debut = ? AND date_fin = ?""",
        (s["organisme"], s["formation_origine"], s["ville"] or "",
         s["date_debut"] or "", s["date_fin"] or "")).fetchone()

    options_domaines = "".join(
        f'<option value="{e(d)}"{" selected" if o and o["domaine_override"] == d else ""}>{e(d)}</option>'
        for d in _domaines_connus(req.conn))
    coche = " checked" if o and o["masquee"] else ""

    contenu = f"""
{_nav_admin("/admin/overrides")}
<h1>Corriger une session</h1>
<div class="carte">
<p><strong>{e(s["formation_origine"])}</strong><br>
{e(s["organisme"])} — {e(s["ville"])} — {e(s["date_debut"] or "permanente")}
{("→ " + e(s["date_fin"])) if s["date_fin"] and s["date_fin"] != s["date_debut"] else ""}<br>
<span class="aide">domaine calculé : {badge_domaine(s["domaine"])}</span></p>
<form method="post" action="/admin/edition">
  {champ_cache("csrf", req.csrf)}
  {champ_cache("retour", retour)}
  {champ_cache("organisme", s["organisme"])}
  {champ_cache("formation", s["formation_origine"])}
  {champ_cache("ville", s["ville"] or "")}
  {champ_cache("date_debut", s["date_debut"] or "")}
  {champ_cache("date_fin", s["date_fin"] or "")}
  <label class="case"><input type="checkbox" name="masquee" value="1"{coche}>
    Masquer cette session (erronée / hors sujet)</label>
  <label>Intitulé corrigé <span class="aide">(vide = garder « {e(s["formation_origine"])} »)</span><br>
    <input type="text" name="formation_override" size="80"
           value="{e(o["formation_override"] if o else "")}"></label>
  <label>Domaine corrigé<br>
    <select name="domaine_override">
      <option value="">— garder le domaine calculé —</option>
      {options_domaines}
    </select></label>
  <label>Note interne<br>
    <input type="text" name="note_interne" size="80"
           value="{e(o["note_interne"] if o else "")}"></label>
  <p><button type="submit" class="btn">Enregistrer</button>
     <a class="btn btn-secondaire" href="{e(retour)}">Annuler</a></p>
  <p class="aide">Ces corrections s'appliquent à cette session précise et
  survivent aux scrapes quotidiens.</p>
</form>
</div>"""
    return Reponse.html(page(req, "Corriger une session", contenu))


def vue_edition_post(req):
    def champ(nom):
        return req.form.get(nom, [""])[0]

    cle = (champ("organisme"), champ("formation"), champ("ville"),
           champ("date_debut"), champ("date_fin"))
    if not cle[0] or not cle[1]:
        return Reponse.redirection("/admin/overrides?msg=champs")
    masquee = 1 if champ("masquee") == "1" else 0
    formation_override = champ("formation_override").strip() or None
    domaine_override = champ("domaine_override").strip() or None
    note = champ("note_interne").strip() or None
    retour = _retour_valide(champ("retour"))

    with req.conn:
        if not masquee and not formation_override and not domaine_override and not note:
            # plus aucune correction : on retire l'override
            req.conn.execute(
                """DELETE FROM overrides WHERE organisme = ? AND formation = ?
                   AND ville = ? AND date_debut = ? AND date_fin = ?""", cle)
        else:
            req.conn.execute(
                """INSERT INTO overrides (organisme, formation, ville, date_debut,
                       date_fin, masquee, domaine_override, formation_override,
                       note_interne, maj_le)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (organisme, formation, ville, date_debut, date_fin)
                   DO UPDATE SET masquee = excluded.masquee,
                       domaine_override = excluded.domaine_override,
                       formation_override = excluded.formation_override,
                       note_interne = excluded.note_interne,
                       maj_le = excluded.maj_le""",
                (*cle, masquee, domaine_override, formation_override, note,
                 datetime.now().isoformat(timespec="seconds")))
    sep = "&" if "?" in retour else "?"
    return Reponse.redirection(f"{retour}{sep}msg=enregistre")


def vue_overrides(req):
    lignes = req.conn.execute("""
        SELECT o.*, (NOT EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.organisme = o.organisme AND s.formation = o.formation
              AND COALESCE(s.ville, '') = o.ville
              AND COALESCE(s.date_debut, '') = o.date_debut
              AND COALESCE(s.date_fin, '') = o.date_fin)) AS orpheline
        FROM overrides o ORDER BY o.maj_le DESC""").fetchall()

    corps = []
    for o in lignes:
        corrections = []
        if o["masquee"]:
            corrections.append("masquée")
        if o["formation_override"]:
            corrections.append(f"intitulé → « {e(o['formation_override'])} »")
        if o["domaine_override"]:
            corrections.append(f"domaine → {e(o['domaine_override'])}")
        if o["note_interne"]:
            corrections.append(f"note : {e(o['note_interne'])}")
        orpheline = ('<span class="texte-alerte" title="La session n\'existe plus '
                     'sous cette clé (renommée ou retirée du site source)">orpheline</span>'
                     if o["orpheline"] else "")
        corps.append(f"""<tr>
<td>{e(o["organisme"])}</td>
<td>{e(o["formation"])}<br><span class="aide">{e(o["ville"])} {e(o["date_debut"])}</span></td>
<td>{" ; ".join(corrections)}</td>
<td>{e(o["maj_le"][:10])} {orpheline}</td>
<td><form method="post" action="/admin/overrides/supprimer">
  {champ_cache("csrf", req.csrf)}{champ_cache("id", o["id"])}
  <button type="submit" class="btn btn-secondaire btn-petit">Retirer</button></form></td>
</tr>""")

    corps_html = "".join(corps) or \
        '<tr><td colspan="5" class="vide">Aucune correction enregistrée.</td></tr>'
    contenu = f"""
{_nav_admin("/admin/overrides")}
<h1>Corrections enregistrées</h1>
<p class="aide">Pour corriger une session : bouton ✎ dans la liste des sessions.
Retirer une correction restaure les valeurs scrapées.</p>
<table class="admin">
<thead><tr><th>Organisme</th><th>Session</th><th>Corrections</th><th>Modifié le</th><th></th></tr></thead>
<tbody>{corps_html}</tbody></table>"""
    return Reponse.html(page(req, "Corrections", contenu))


def vue_overrides_supprimer(req):
    try:
        id_override = int(req.form.get("id", [""])[0])
    except ValueError:
        return Reponse.redirection("/admin/overrides?msg=champs")
    with req.conn:
        req.conn.execute("DELETE FROM overrides WHERE id = ?", (id_override,))
    return Reponse.redirection("/admin/overrides?msg=supprime")


# --- Statistiques ------------------------------------------------------------

def _tableau_barres(conn, titre: str, sql: str, params=()) -> str:
    lignes = conn.execute(sql, params).fetchall()
    if not lignes:
        return ""
    maxi = max(r[1] for r in lignes) or 1
    corps = "".join(
        f'<tr><td>{e(r[0]) or "<em>non renseigné</em>"}</td>'
        f'<td class="col-num">{r[1]}</td>'
        f'<td class="col-barre"><div class="barre" style="width:{r[1] * 100 // maxi}%"></div></td></tr>'
        for r in lignes)
    return (f'<div class="carte-stat"><h2>{e(titre)}</h2>'
            f'<table class="stats"><tbody>{corps}</tbody></table></div>')


def vue_stats(req):
    conn = req.conn
    base = ("FROM sessions_effectives WHERE masquee = 0 AND last_seen = ("
            "SELECT MAX(s2.last_seen) FROM sessions s2 "
            "WHERE s2.organisme = sessions_effectives.organisme)")
    compteurs = conn.execute(f"""SELECT
        COUNT(*),
        SUM(CASE WHEN date_debut IS NULL THEN 1 ELSE 0 END),
        SUM(CASE WHEN date_debut IS NOT NULL AND date_fin >= date('now','localtime') THEN 1 ELSE 0 END),
        SUM(CASE WHEN date_fin < date('now','localtime') THEN 1 ELSE 0 END)
        {base}""").fetchone()

    contenu = f"""
{_nav_admin("/admin/stats")}
<h1>Statistiques <span class="aide">(offre courante, sessions non masquées)</span></h1>
<div class="cartes-chiffres">
  <div class="chiffre"><strong>{compteurs[0] or 0}</strong>sessions</div>
  <div class="chiffre"><strong>{compteurs[2] or 0}</strong>à venir</div>
  <div class="chiffre"><strong>{compteurs[3] or 0}</strong>passées</div>
  <div class="chiffre"><strong>{compteurs[1] or 0}</strong>permanentes</div>
</div>
{_tableau_barres(conn, "Par domaine", f"SELECT domaine, COUNT(*) {base} GROUP BY domaine ORDER BY 2 DESC")}
{_tableau_barres(conn, "Par organisme", f"SELECT organisme, COUNT(*) {base} GROUP BY organisme ORDER BY 2 DESC")}
{_tableau_barres(conn, "Par ville (top 15)", f"SELECT ville, COUNT(*) {base} GROUP BY ville ORDER BY 2 DESC LIMIT 15")}
"""
    return Reponse.html(page(req, "Statistiques", contenu))


# --- Utilisateurs ------------------------------------------------------------

def _dernier_admin_actif(conn, id_utilisateur: int) -> bool:
    autre = conn.execute(
        "SELECT COUNT(*) FROM utilisateurs WHERE admin = 1 AND actif = 1 AND id != ?",
        (id_utilisateur,)).fetchone()[0]
    return autre == 0


def vue_utilisateurs(req, nouveau_mdp: str | None = None):
    """`nouveau_mdp` : affiché une seule fois, dans la réponse directe du POST
    de création/réinitialisation (jamais dans une URL)."""
    lignes = req.conn.execute(
        "SELECT * FROM utilisateurs ORDER BY identifiant").fetchall()
    corps = []
    for u in lignes:
        actions = []
        for action, libelle in (("desactiver", "Désactiver") if u["actif"] else ("reactiver", "Réactiver"),
                                ("retrograder", "Retirer admin") if u["admin"] else ("promouvoir", "Rendre admin"),
                                ("reinit_mdp", "Nouveau mot de passe")):
            actions.append(
                f'<form method="post" action="/admin/utilisateurs" class="inline">'
                f'{champ_cache("csrf", req.csrf)}{champ_cache("id", u["id"])}'
                f'{champ_cache("action", action)}'
                f'<button type="submit" class="btn btn-secondaire btn-petit">{libelle}</button></form>')
        etat = "actif" if u["actif"] else '<span class="texte-erreur">désactivé</span>'
        role = "admin" if u["admin"] else "utilisateur"
        dernier = e(u["dernier_acces"][:16].replace("T", " ")) if u["dernier_acces"] else "jamais"
        corps.append(f"<tr><td>{e(u['identifiant'])}</td><td>{role}</td>"
                     f"<td>{etat}</td><td>{dernier}</td><td>{''.join(actions)}</td></tr>")

    encart_mdp = ""
    if nouveau_mdp:
        encart_mdp = (f'<div class="flash flash-ok">Mot de passe (affiché une '
                      f'seule fois) : <code>{e(nouveau_mdp)}</code></div>')

    contenu = f"""
{_nav_admin("/admin/utilisateurs")}
<h1>Utilisateurs</h1>
{encart_mdp}
<table class="admin">
<thead><tr><th>Identifiant</th><th>Rôle</th><th>État</th><th>Dernier accès</th><th>Actions</th></tr></thead>
<tbody>{"".join(corps)}</tbody></table>
<div class="carte">
<h2>Créer un compte</h2>
<form method="post" action="/admin/utilisateurs">
  {champ_cache("csrf", req.csrf)}{champ_cache("action", "creer")}
  <label>Identifiant <input type="text" name="identifiant" required></label>
  <label class="case"><input type="checkbox" name="admin" value="1"> Administrateur</label>
  <button type="submit" class="btn">Créer</button>
  <p class="aide">Le mot de passe initial est généré et affiché après création.</p>
</form>
</div>"""
    return Reponse.html(page(req, "Utilisateurs", contenu))


def vue_utilisateurs_post(req):
    def champ(nom):
        return req.form.get(nom, [""])[0]

    action = champ("action")
    conn = req.conn

    if action == "creer":
        identifiant = champ("identifiant").strip()
        if not identifiant or len(identifiant) > 60:
            return Reponse.redirection("/admin/utilisateurs?msg=champs")
        if conn.execute("SELECT 1 FROM utilisateurs WHERE identifiant = ?",
                        (identifiant,)).fetchone():
            return Reponse.redirection("/admin/utilisateurs?msg=identifiant_pris")
        mdp = secrets.token_urlsafe(10)
        with conn:
            conn.execute(
                """INSERT INTO utilisateurs (identifiant, mdp_hash, admin, actif, cree_le)
                   VALUES (?, ?, ?, 1, ?)""",
                (identifiant, auth.hacher_mdp(mdp),
                 1 if champ("admin") == "1" else 0,
                 datetime.now().isoformat(timespec="seconds")))
        return vue_utilisateurs(req, nouveau_mdp=mdp)

    try:
        id_utilisateur = int(champ("id"))
    except ValueError:
        return Reponse.redirection("/admin/utilisateurs?msg=champs")
    cible = conn.execute("SELECT * FROM utilisateurs WHERE id = ?",
                         (id_utilisateur,)).fetchone()
    if not cible:
        return Reponse.redirection("/admin/utilisateurs?msg=champs")

    if action in ("desactiver", "retrograder") and cible["admin"] and cible["actif"] \
            and _dernier_admin_actif(conn, id_utilisateur):
        return Reponse.redirection("/admin/utilisateurs?msg=dernier_admin")

    with conn:
        if action == "desactiver":
            conn.execute("UPDATE utilisateurs SET actif = 0 WHERE id = ?", (id_utilisateur,))
        elif action == "reactiver":
            conn.execute("UPDATE utilisateurs SET actif = 1 WHERE id = ?", (id_utilisateur,))
        elif action == "promouvoir":
            conn.execute("UPDATE utilisateurs SET admin = 1 WHERE id = ?", (id_utilisateur,))
        elif action == "retrograder":
            conn.execute("UPDATE utilisateurs SET admin = 0 WHERE id = ?", (id_utilisateur,))
        elif action == "reinit_mdp":
            mdp = secrets.token_urlsafe(10)
            conn.execute("UPDATE utilisateurs SET mdp_hash = ? WHERE id = ?",
                         (auth.hacher_mdp(mdp), id_utilisateur))
            return vue_utilisateurs(req, nouveau_mdp=mdp)
        else:
            return Reponse.redirection("/admin/utilisateurs?msg=champs")
    return Reponse.redirection("/admin/utilisateurs?msg=utilisateur_maj")
