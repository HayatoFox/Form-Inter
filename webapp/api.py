"""API JSON consommée par l'interface React (`frontend/`).

Toutes les routes renvoient du JSON et sont montées sous /api. Le contrôle
d'accès (connecté / admin) et le CSRF restent appliqués par le routeur de
`app.py` : ce module ne contient que la logique métier et la sérialisation.

Conventions :
- les clés JSON reprennent les noms de colonnes de la base (pas de
  renommage : une seule nomenclature entre SQL, API et interface) ;
- les erreurs métier renvoient {"erreur": "<code>"} avec un statut 4xx, le
  code étant traduit côté interface (jamais de texte libre remonté).
"""

import json
import secrets
from datetime import date, datetime

from . import auth, config, exports, filtres, scrape_ctl
from .app import Reponse

# --- Sérialisation -----------------------------------------------------------

# Colonnes de sessions_effectives exposées telles quelles
_CHAMPS_SESSION = (
    "id", "organisme", "formation", "formation_origine", "type_formation",
    "domaine", "ville", "date_debut", "date_fin", "duree_jours", "tarif",
    "remarque", "disponibilite", "url_programme", "source_url",
    "first_seen", "last_seen", "note_interne")


def _session_json(ligne) -> dict:
    d = {c: ligne[c] for c in _CHAMPS_SESSION}
    d["a_override"] = bool(ligne["a_override"])
    d["permanente"] = ligne["date_debut"] is None
    return d


def _lien_sur(url) -> str | None:
    """Les URLs viennent de sites tiers : on ne renvoie que du http(s)."""
    if url and str(url).startswith(("http://", "https://")):
        return url
    return None


def _utilisateur_json(u) -> dict:
    return {"id": u["id"], "identifiant": u["identifiant"],
            "admin": bool(u["admin"]), "actif": bool(u["actif"]),
            "cree_le": u["cree_le"], "dernier_acces": u["dernier_acces"]}


# --- Session de travail (authentification) -----------------------------------

def moi(req):
    """État de connexion : appelé au démarrage de l'interface."""
    utilisateur = auth.utilisateur_depuis_cookie(req.conn, req.cookie_session)
    if not utilisateur:
        return Reponse.json({"utilisateur": None, "csrf": None})
    return Reponse.json({"utilisateur": _utilisateur_json(utilisateur),
                         "csrf": req.csrf})


def connexion(req):
    identifiant = str(req.json.get("identifiant", "")).strip()
    mdp = str(req.json.get("mdp", ""))
    utilisateur = req.conn.execute(
        "SELECT * FROM utilisateurs WHERE identifiant = ? AND actif = 1",
        (identifiant,)).fetchone()
    if not utilisateur or not auth.verifier_mdp(mdp, utilisateur["mdp_hash"]):
        import time
        time.sleep(0.5)  # freine les tentatives en rafale
        return Reponse.json({"erreur": "identifiants"}, 401)

    with req.conn:
        req.conn.execute("UPDATE utilisateurs SET dernier_acces = ? WHERE id = ?",
                         (datetime.now().isoformat(timespec="seconds"),
                          utilisateur["id"]))
    cookie = auth.creer_cookie(utilisateur["id"])
    reponse = Reponse.json({"utilisateur": _utilisateur_json(utilisateur),
                            "csrf": auth.jeton_csrf(cookie)})
    reponse.poser_cookie(cookie)
    return reponse


def deconnexion(req):
    reponse = Reponse.json({"ok": True})
    reponse.poser_cookie("", max_age=0)
    return reponse


def changer_mdp(req):
    """Changement de mot de passe par l'utilisateur lui-même."""
    actuel = str(req.json.get("actuel", ""))
    nouveau = str(req.json.get("nouveau", ""))
    if len(nouveau) < 10:
        return Reponse.json({"erreur": "mdp_trop_court"}, 400)
    ligne = req.conn.execute("SELECT mdp_hash FROM utilisateurs WHERE id = ?",
                             (req.utilisateur["id"],)).fetchone()
    if not auth.verifier_mdp(actuel, ligne["mdp_hash"]):
        return Reponse.json({"erreur": "mdp_actuel"}, 400)
    with req.conn:
        req.conn.execute("UPDATE utilisateurs SET mdp_hash = ? WHERE id = ?",
                         (auth.hacher_mdp(nouveau), req.utilisateur["id"]))
    return Reponse.json({"ok": True})


# --- Liste des sessions ------------------------------------------------------

def liste_sessions(req):
    f = filtres.parser(req.query)
    lignes, total = filtres.requete_sessions(req.conn, f)
    nb_pages = max(1, -(-total // f["par_page"]))
    return Reponse.json({
        "lignes": [_session_json(s) for s in lignes],
        "total": total,
        "page": min(f["page"], nb_pages),
        "nb_pages": nb_pages,
        "par_page": f["par_page"],
        "filtres": f,
        "query": filtres.vers_query(f),
        "export_csv": filtres.url_liste(f, base="/export.csv", page=1),
        "export_xlsx": filtres.url_liste(f, base="/export.xlsx", page=1),
    })


def detail_session(req, id_session: str):
    s = req.conn.execute("SELECT * FROM sessions_effectives WHERE id = ?",
                         (int(id_session),)).fetchone()
    if not s:
        return Reponse.json({"erreur": "introuvable"}, 404)
    detail = _session_json(s)
    detail["url_programme"] = _lien_sur(s["url_programme"])
    detail["source_url"] = _lien_sur(s["source_url"])

    # Autres dates de la même formation, chez le même organisme : la question
    # que l'équipe se pose systématiquement en consultant une session.
    autres = req.conn.execute(
        """SELECT id, ville, date_debut, date_fin, duree_jours, tarif, disponibilite
           FROM sessions_effectives
           WHERE organisme = ? AND formation = ? AND id != ? AND masquee = 0
             AND (date_debut IS NULL OR date_fin >= date('now','localtime'))
           ORDER BY date_debut IS NULL, date_debut LIMIT 12""",
        (s["organisme"], s["formation"], s["id"])).fetchall()
    detail["autres_dates"] = [dict(r) for r in autres]
    return Reponse.json(detail)


def facettes(req):
    """Valeurs disponibles pour les filtres, avec leur nombre de sessions.

    Comptées sur l'offre courante à venir : proposer une ville dont toutes
    les sessions sont passées n'aide personne."""
    conn = req.conn
    portee = ("FROM sessions_effectives WHERE masquee = 0"
              " AND last_seen = (SELECT MAX(s2.last_seen) FROM sessions s2"
              "                  WHERE s2.organisme = sessions_effectives.organisme)"
              " AND (date_debut IS NULL OR date_fin >= date('now','localtime'))")

    def compter(colonne):
        return [{"valeur": r[0], "nb": r[1]} for r in conn.execute(
            f"SELECT {colonne}, COUNT(*) {portee} AND {colonne} IS NOT NULL"
            f" AND {colonne} != '' GROUP BY {colonne} ORDER BY {colonne} COLLATE NOCASE")]

    bornes = conn.execute(
        f"SELECT MIN(date_debut), MAX(date_debut) {portee}").fetchone()
    return Reponse.json({
        "domaines": compter("domaine"),
        "organismes": compter("organisme"),
        "villes": compter("ville"),
        "date_min": bornes[0], "date_max": bornes[1],
        "par_page_choix": list(config.PAR_PAGE_CHOIX),
        "tris": sorted(filtres.TRIS),
    })


def resume(req):
    """Chiffres d'en-tête de la page Sessions (offre courante à venir)."""
    portee = ("FROM sessions_effectives WHERE masquee = 0"
              " AND last_seen = (SELECT MAX(s2.last_seen) FROM sessions s2"
              "                  WHERE s2.organisme = sessions_effectives.organisme)")
    r = req.conn.execute(f"""SELECT
        SUM(CASE WHEN date_debut IS NULL OR date_fin >= date('now','localtime')
                 THEN 1 ELSE 0 END),
        SUM(CASE WHEN date_debut BETWEEN date('now','localtime')
                 AND date('now','localtime','+30 days') THEN 1 ELSE 0 END),
        COUNT(DISTINCT ville), COUNT(DISTINCT organisme), MAX(last_seen)
        {portee}""").fetchone()
    return Reponse.json({"a_venir": r[0] or 0, "sous_30_jours": r[1] or 0,
                         "villes": r[2] or 0, "organismes": r[3] or 0,
                         "derniere_collecte": r[4]})


# --- Vues enregistrées -------------------------------------------------------

def _vue_json(v, id_utilisateur: int) -> dict:
    return {"id": v["id"], "nom": v["nom"], "query": v["filtres"],
            "partagee": bool(v["partagee"]), "cree_le": v["cree_le"],
            "proprietaire": v["proprietaire"],
            "a_moi": v["utilisateur_id"] == id_utilisateur}


def liste_vues(req):
    lignes = req.conn.execute(
        """SELECT v.*, u.identifiant AS proprietaire FROM vues v
           JOIN utilisateurs u ON u.id = v.utilisateur_id
           WHERE v.utilisateur_id = ? OR v.partagee = 1
           ORDER BY v.partagee, v.nom COLLATE NOCASE""",
        (req.utilisateur["id"],)).fetchall()
    return Reponse.json([_vue_json(v, req.utilisateur["id"]) for v in lignes])


def creer_vue(req):
    nom = str(req.json.get("nom", "")).strip()[:60]
    if not nom:
        return Reponse.json({"erreur": "champs"}, 400)
    if req.conn.execute("SELECT COUNT(*) FROM vues WHERE utilisateur_id = ?",
                        (req.utilisateur["id"],)).fetchone()[0] >= 50:
        return Reponse.json({"erreur": "trop_de_vues"}, 400)
    # La query est revalidée par le parser avant stockage : ce qui est
    # enregistré est toujours une combinaison de filtres légitime.
    query = filtres.vers_query(filtres.depuis_query(str(req.json.get("query", ""))))
    partagee = 1 if req.json.get("partagee") else 0
    try:
        with req.conn:
            curseur = req.conn.execute(
                """INSERT INTO vues (utilisateur_id, nom, filtres, partagee, cree_le)
                   VALUES (?, ?, ?, ?, ?)""",
                (req.utilisateur["id"], nom, query, partagee,
                 datetime.now().isoformat(timespec="seconds")))
    except Exception:
        return Reponse.json({"erreur": "nom_pris"}, 409)
    return Reponse.json({"id": curseur.lastrowid, "nom": nom, "query": query,
                         "partagee": bool(partagee), "a_moi": True,
                         "proprietaire": req.utilisateur["identifiant"]}, 201)


def supprimer_vue(req, id_vue: str):
    """Une vue ne peut être supprimée que par son auteur."""
    with req.conn:
        curseur = req.conn.execute(
            "DELETE FROM vues WHERE id = ? AND utilisateur_id = ?",
            (int(id_vue), req.utilisateur["id"]))
    if not curseur.rowcount:
        return Reponse.json({"erreur": "introuvable"}, 404)
    return Reponse.json({"ok": True})


# --- Back office : santé des scrapers ----------------------------------------

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
    return {"organisme": organisme, "niveau": niveau, "alerte": alerte,
            "dernier": dict(dernier) if dernier else None,
            "precedent_nb": precedent_ok["nb_sessions"] if precedent_ok else None}


def sante(req):
    conn = req.conn
    organismes = [r[0] for r in conn.execute(
        """SELECT DISTINCT organisme FROM (
             SELECT organisme FROM sessions UNION SELECT organisme FROM scrape_runs)
           ORDER BY organisme""")]
    etats = [_sante_organisme(conn, o) for o in organismes]
    for etat in etats:
        etat["nb_en_base"] = conn.execute(
            "SELECT COUNT(*) FROM sessions WHERE organisme = ?",
            (etat["organisme"],)).fetchone()[0]

    historique = [dict(r) for r in conn.execute(
        "SELECT * FROM scrape_runs ORDER BY demarre_le DESC, id DESC LIMIT 40")]
    return Reponse.json({"organismes": etats, "historique": historique,
                         "scrape_en_cours": scrape_ctl.scrape_en_cours()})


def lancer_scrape(req):
    if not scrape_ctl.demarrer_scrape():
        return Reponse.json({"erreur": "scrape_deja"}, 409)
    return Reponse.json({"ok": True})


# --- Back office : statistiques ----------------------------------------------

_PORTEE_STATS = ("FROM sessions_effectives WHERE masquee = 0 AND last_seen = ("
                 "SELECT MAX(s2.last_seen) FROM sessions s2 "
                 "WHERE s2.organisme = sessions_effectives.organisme)")


def stats(req):
    conn = req.conn
    compteurs = conn.execute(f"""SELECT
        COUNT(*),
        SUM(CASE WHEN date_debut IS NULL THEN 1 ELSE 0 END),
        SUM(CASE WHEN date_debut IS NOT NULL AND date_fin >= date('now','localtime')
                 THEN 1 ELSE 0 END),
        SUM(CASE WHEN date_fin < date('now','localtime') THEN 1 ELSE 0 END)
        {_PORTEE_STATS}""").fetchone()

    def repartition(colonne, limite=None):
        sql = (f"SELECT {colonne}, COUNT(*) {_PORTEE_STATS}"
               f" GROUP BY {colonne} ORDER BY 2 DESC")
        if limite:
            sql += f" LIMIT {int(limite)}"
        return [{"valeur": r[0], "nb": r[1]} for r in conn.execute(sql)]

    calendrier = [{"mois": r[0], "nb": r[1]} for r in conn.execute(
        f"""SELECT substr(date_debut, 1, 7), COUNT(*) {_PORTEE_STATS}
            AND date_debut IS NOT NULL AND date_fin >= date('now','localtime')
            GROUP BY 1 ORDER BY 1 LIMIT 18""")]

    return Reponse.json({
        "total": compteurs[0] or 0, "permanentes": compteurs[1] or 0,
        "a_venir": compteurs[2] or 0, "passees": compteurs[3] or 0,
        "par_domaine": repartition("domaine"),
        "par_organisme": repartition("organisme"),
        "par_ville": repartition("ville", 15),
        "par_mois": calendrier,
    })


# --- Back office : corrections (overrides) -----------------------------------

def domaines_connus(req):
    from scraper.domaines import AUTRE, REGLES
    connus = [d for d, _ in REGLES] + [AUTRE]
    en_base = [r[0] for r in req.conn.execute(
        "SELECT DISTINCT domaine FROM sessions WHERE domaine IS NOT NULL")]
    return Reponse.json(sorted(set(connus) | set(en_base)))


def liste_overrides(req):
    lignes = req.conn.execute("""
        SELECT o.*, (NOT EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.organisme = o.organisme AND s.formation = o.formation
              AND COALESCE(s.ville, '') = o.ville
              AND COALESCE(s.date_debut, '') = o.date_debut
              AND COALESCE(s.date_fin, '') = o.date_fin)) AS orpheline
        FROM overrides o ORDER BY o.maj_le DESC""").fetchall()
    return Reponse.json([{**dict(o), "masquee": bool(o["masquee"]),
                          "orpheline": bool(o["orpheline"])} for o in lignes])


def enregistrer_override(req):
    """Enregistre (ou retire) la correction d'une session, désignée par sa
    clé naturelle — jamais par son id, qui change si la base est régénérée."""
    d = req.json
    cle = (str(d.get("organisme", "")), str(d.get("formation", "")),
           str(d.get("ville") or ""), str(d.get("date_debut") or ""),
           str(d.get("date_fin") or ""))
    if not cle[0] or not cle[1]:
        return Reponse.json({"erreur": "champs"}, 400)
    masquee = 1 if d.get("masquee") else 0
    formation_override = str(d.get("formation_override") or "").strip() or None
    domaine_override = str(d.get("domaine_override") or "").strip() or None
    note = str(d.get("note_interne") or "").strip() or None

    with req.conn:
        if not (masquee or formation_override or domaine_override or note):
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
    return Reponse.json({"ok": True})


def supprimer_override(req, id_override: str):
    with req.conn:
        req.conn.execute("DELETE FROM overrides WHERE id = ?", (int(id_override),))
    return Reponse.json({"ok": True})


# --- Back office : utilisateurs ----------------------------------------------

def _dernier_admin_actif(conn, id_utilisateur: int) -> bool:
    return conn.execute(
        "SELECT COUNT(*) FROM utilisateurs WHERE admin = 1 AND actif = 1 AND id != ?",
        (id_utilisateur,)).fetchone()[0] == 0


def liste_utilisateurs(req):
    lignes = req.conn.execute(
        "SELECT * FROM utilisateurs ORDER BY identifiant").fetchall()
    return Reponse.json([_utilisateur_json(u) for u in lignes])


def creer_utilisateur(req):
    identifiant = str(req.json.get("identifiant", "")).strip()
    if not identifiant or len(identifiant) > 60:
        return Reponse.json({"erreur": "champs"}, 400)
    if req.conn.execute("SELECT 1 FROM utilisateurs WHERE identifiant = ?",
                        (identifiant,)).fetchone():
        return Reponse.json({"erreur": "identifiant_pris"}, 409)
    mdp = secrets.token_urlsafe(10)
    with req.conn:
        req.conn.execute(
            """INSERT INTO utilisateurs (identifiant, mdp_hash, admin, actif, cree_le)
               VALUES (?, ?, ?, 1, ?)""",
            (identifiant, auth.hacher_mdp(mdp),
             1 if req.json.get("admin") else 0,
             datetime.now().isoformat(timespec="seconds")))
    # Seule réponse où le mot de passe transite : il n'est plus jamais lisible.
    return Reponse.json({"ok": True, "mdp": mdp}, 201)


def modifier_utilisateur(req, id_utilisateur: str):
    conn = req.conn
    uid = int(id_utilisateur)
    action = str(req.json.get("action", ""))
    cible = conn.execute("SELECT * FROM utilisateurs WHERE id = ?", (uid,)).fetchone()
    if not cible:
        return Reponse.json({"erreur": "introuvable"}, 404)
    if action in ("desactiver", "retrograder") and cible["admin"] and cible["actif"] \
            and _dernier_admin_actif(conn, uid):
        return Reponse.json({"erreur": "dernier_admin"}, 409)

    colonnes = {"desactiver": ("actif", 0), "reactiver": ("actif", 1),
                "promouvoir": ("admin", 1), "retrograder": ("admin", 0)}
    with conn:
        if action in colonnes:
            colonne, valeur = colonnes[action]
            conn.execute(f"UPDATE utilisateurs SET {colonne} = ? WHERE id = ?",
                         (valeur, uid))
        elif action == "reinit_mdp":
            mdp = secrets.token_urlsafe(10)
            conn.execute("UPDATE utilisateurs SET mdp_hash = ? WHERE id = ?",
                         (auth.hacher_mdp(mdp), uid))
            return Reponse.json({"ok": True, "mdp": mdp})
        else:
            return Reponse.json({"erreur": "champs"}, 400)
    return Reponse.json({"ok": True})


# --- Exports (fichiers, hors JSON) -------------------------------------------

def export_csv(req):
    f = filtres.parser(req.query)
    lignes, _ = filtres.requete_sessions(req.conn, f, pagine=False)
    return Reponse.fichier(exports.generer_csv(lignes), "text/csv; charset=utf-8",
                           f"sessions_{date.today().isoformat()}.csv")


def export_xlsx(req):
    f = filtres.parser(req.query)
    lignes, _ = filtres.requete_sessions(req.conn, f, pagine=False)
    return Reponse.fichier(
        exports.generer_xlsx(lignes),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        f"sessions_{date.today().isoformat()}.xlsx")
