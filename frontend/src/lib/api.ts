/** Client HTTP de l'API : cookie de session + jeton CSRF en en-tête. */

export class ErreurApi extends Error {
  constructor(
    readonly code: string,
    readonly statut: number,
  ) {
    super(code)
  }
}

/** Le jeton CSRF est dérivé du cookie de session côté serveur : il est
 *  récupéré à la connexion (ou au démarrage via /api/moi) et rejoué sur
 *  toutes les écritures. */
let jetonCsrf: string | null = null

export function definirCsrf(jeton: string | null) {
  jetonCsrf = jeton
}

type Options = { methode?: 'GET' | 'POST' | 'PUT' | 'DELETE'; corps?: unknown }

async function requete<T>(chemin: string, options: Options = {}): Promise<T> {
  const methode = options.methode ?? 'GET'
  const entetes: Record<string, string> = {}
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json'
  if (methode !== 'GET' && jetonCsrf) entetes['X-CSRF-Token'] = jetonCsrf

  const reponse = await fetch(chemin, {
    method: methode,
    headers: entetes,
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    credentials: 'same-origin',
  })

  if (!reponse.ok) {
    let code = `http_${reponse.status}`
    try {
      const donnees = await reponse.json()
      if (donnees?.erreur) code = donnees.erreur
    } catch {
      /* réponse non-JSON : on garde le code générique */
    }
    throw new ErreurApi(code, reponse.status)
  }
  if (reponse.status === 204) return undefined as T
  return (await reponse.json()) as T
}

export const api = {
  get: <T,>(chemin: string) => requete<T>(chemin),
  post: <T,>(chemin: string, corps?: unknown) =>
    requete<T>(chemin, { methode: 'POST', corps: corps ?? {} }),
  supprimer: <T,>(chemin: string) => requete<T>(chemin, { methode: 'DELETE' }),
}

/** Messages affichés à l'utilisateur pour les codes d'erreur de l'API. */
const MESSAGES: Record<string, string> = {
  identifiants: 'Identifiant ou mot de passe incorrect.',
  non_connecte: 'Session expirée, reconnectez-vous.',
  reserve_admin: 'Cette page est réservée aux administrateurs.',
  csrf: 'Session expirée, rechargez la page.',
  champs: 'Champs manquants ou invalides.',
  introuvable: 'Élément introuvable.',
  nom_pris: 'Vous avez déjà une vue portant ce nom.',
  trop_de_vues: 'Limite de 50 vues enregistrées atteinte.',
  identifiant_pris: 'Cet identifiant existe déjà.',
  dernier_admin: "Impossible : c'est le dernier compte administrateur actif.",
  scrape_deja: 'Un scrape est déjà en cours.',
  mdp_actuel: 'Mot de passe actuel incorrect.',
  mdp_trop_court: 'Le nouveau mot de passe doit faire au moins 10 caractères.',
  interne: 'Erreur interne du serveur.',
}

export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurApi) {
    return MESSAGES[erreur.code] ?? `Erreur inattendue (${erreur.code}).`
  }
  return 'Le serveur est injoignable.'
}
