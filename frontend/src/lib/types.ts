/** Formes des données renvoyées par l'API (webapp/api.py). */

export type Session = {
  id: number
  organisme: string
  formation: string
  formation_origine: string
  type_formation: string | null
  domaine: string | null
  ville: string | null
  date_debut: string | null
  date_fin: string | null
  duree_jours: number | null
  tarif: string | null
  remarque: string | null
  disponibilite: string | null
  url_programme: string | null
  source_url: string | null
  first_seen: string
  last_seen: string
  note_interne: string | null
  a_override: boolean
  permanente: boolean
}

export type AutreDate = {
  id: number
  ville: string | null
  date_debut: string | null
  date_fin: string | null
  duree_jours: number | null
  tarif: string | null
  disponibilite: string | null
}

export type SessionDetail = Session & { autres_dates: AutreDate[] }

export type Filtres = {
  domaines: string[]
  organismes: string[]
  ville: string
  du: string
  au: string
  q: string
  duree_max: number | null
  passees: boolean
  permanentes: boolean
  historique: boolean
  tri: string
  ordre: 'asc' | 'desc'
  page: number
  par_page: number
}

export type PageSessions = {
  lignes: Session[]
  total: number
  page: number
  nb_pages: number
  par_page: number
  filtres: Filtres
  query: string
  export_csv: string
  export_xlsx: string
}

export type Facette = { valeur: string; nb: number }

export type Facettes = {
  domaines: Facette[]
  organismes: Facette[]
  villes: Facette[]
  date_min: string | null
  date_max: string | null
  par_page_choix: number[]
  tris: string[]
}

export type Resume = {
  a_venir: number
  sous_30_jours: number
  villes: number
  organismes: number
  derniere_collecte: string | null
}

export type Utilisateur = {
  id: number
  identifiant: string
  admin: boolean
  actif: boolean
  cree_le: string
  dernier_acces: string | null
}

export type Vue = {
  id: number
  nom: string
  query: string
  partagee: boolean
  a_moi: boolean
  proprietaire: string
  cree_le?: string
}

export type Passage = {
  id: number
  organisme: string
  demarre_le: string
  duree_s: number | null
  nb_sessions: number | null
  statut: 'ok' | 'erreur'
  message: string | null
  declencheur: string
}

export type Niveau = 'ok' | 'alerte' | 'erreur'

export type EtatOrganisme = {
  organisme: string
  niveau: Niveau
  alerte: string
  dernier: Passage | null
  precedent_nb: number | null
  nb_en_base: number
}

export type Sante = {
  organismes: EtatOrganisme[]
  historique: Passage[]
  scrape_en_cours: string | null
}

export type Stats = {
  total: number
  permanentes: number
  a_venir: number
  passees: number
  par_domaine: Facette[]
  par_organisme: Facette[]
  par_ville: Facette[]
  par_mois: { mois: string; nb: number }[]
}

export type Override = {
  id: number
  organisme: string
  formation: string
  ville: string
  date_debut: string
  date_fin: string
  masquee: boolean
  domaine_override: string | null
  formation_override: string | null
  note_interne: string | null
  maj_le: string
  orpheline: boolean
}
