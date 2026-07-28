"""Comptes utilisateurs et sessions : scrypt, cookie signé HMAC, CSRF.

Module volontairement isolé des vues : le jour où PROINSEC passe au SSO,
seules les fonctions de ce fichier changent.
"""

import hashlib
import hmac
import secrets
import sqlite3
import time
from datetime import datetime

from . import config

COOKIE_NOM = "session"


# --- Mots de passe -----------------------------------------------------------

def hacher_mdp(mdp: str) -> str:
    sel = secrets.token_bytes(16)
    h = hashlib.scrypt(mdp.encode(), salt=sel, n=2**14, r=8, p=1)
    return f"scrypt${sel.hex()}${h.hex()}"


def verifier_mdp(mdp: str, stocke: str) -> bool:
    try:
        algo, sel_hex, h_hex = stocke.split("$")
        if algo != "scrypt":
            return False
        h = hashlib.scrypt(mdp.encode(), salt=bytes.fromhex(sel_hex),
                           n=2**14, r=8, p=1)
        return hmac.compare_digest(h.hex(), h_hex)
    except (ValueError, AttributeError):
        return False


# --- Cookie de session signé -------------------------------------------------

def _signer(donnee: str) -> str:
    return hmac.new(config.SECRET, donnee.encode(), hashlib.sha256).hexdigest()


def creer_cookie(uid: int) -> str:
    expiration = int(time.time()) + config.DUREE_SESSION_S
    base = f"{uid}.{expiration}"
    return f"{base}.{_signer('session.' + base)}"


def uid_depuis_cookie(valeur: str | None) -> int | None:
    if not valeur:
        return None
    try:
        uid, expiration, signature = valeur.rsplit(".", 2)
        base = f"{uid}.{expiration}"
        if not hmac.compare_digest(signature, _signer("session." + base)):
            return None
        if int(expiration) < time.time():
            return None
        return int(uid)
    except (ValueError, AttributeError):
        return None


def utilisateur_depuis_cookie(conn: sqlite3.Connection, valeur: str | None):
    """Retourne la ligne utilisateur (Row) si le cookie est valide et le
    compte actif, sinon None."""
    uid = uid_depuis_cookie(valeur)
    if uid is None:
        return None
    return conn.execute(
        "SELECT * FROM utilisateurs WHERE id = ? AND actif = 1", (uid,)).fetchone()


# --- CSRF --------------------------------------------------------------------

def jeton_csrf(cookie_valeur: str) -> str:
    return _signer("csrf." + (cookie_valeur or ""))


def verifier_csrf(cookie_valeur: str | None, jeton: str | None) -> bool:
    if not cookie_valeur or not jeton:
        return False
    return hmac.compare_digest(jeton, jeton_csrf(cookie_valeur))


# --- Bootstrap ---------------------------------------------------------------

def bootstrap_admin(conn: sqlite3.Connection) -> None:
    """Crée le premier compte admin si la table est vide (env
    WEBAPP_ADMIN_USER / WEBAPP_ADMIN_PASSWORD, mot de passe généré sinon)."""
    if conn.execute("SELECT COUNT(*) FROM utilisateurs").fetchone()[0]:
        return
    mdp = config.ADMIN_INITIAL_PASSWORD or secrets.token_urlsafe(12)
    with conn:
        conn.execute(
            """INSERT INTO utilisateurs (identifiant, mdp_hash, admin, actif, cree_le)
               VALUES (?, ?, 1, 1, ?)""",
            (config.ADMIN_INITIAL_USER, hacher_mdp(mdp),
             datetime.now().isoformat(timespec="seconds")))
    print(f"[webapp] Premier compte admin créé : {config.ADMIN_INITIAL_USER}")
    if not config.ADMIN_INITIAL_PASSWORD:
        print(f"[webapp] Mot de passe généré : {mdp}")
        print("[webapp] (changez-le, ou définissez WEBAPP_ADMIN_PASSWORD)")
