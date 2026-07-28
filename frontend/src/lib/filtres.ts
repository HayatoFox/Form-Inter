/** Filtres de la liste des sessions.
 *
 *  L'URL est la source de vérité : un lien collé dans un message rouvre
 *  exactement la même liste, et le bouton Retour du navigateur fonctionne.
 *  Les clés reprennent celles attendues par `webapp/filtres.py` — la query
 *  string produite ici est envoyée telle quelle à l'API et aux exports.
 */

import type { Filtres } from './types'
import { aujourdhuiIso, dateCourte, duree } from './format'

export const DEFAUTS: Filtres = {
  domaines: [],
  organismes: [],
  ville: '',
  du: '',
  au: '',
  q: '',
  duree_max: null,
  passees: false,
  permanentes: true,
  historique: false,
  tri: 'date',
  ordre: 'asc',
  page: 1,
  par_page: 50,
}

export function depuisParams(params: URLSearchParams): Filtres {
  const soumis = params.get('f') === '1'
  const bool = (nom: string, defaut: boolean) =>
    soumis ? params.get(nom) === '1' : defaut
  const dureeMax = Number(params.get('duree_max'))
  const page = Number(params.get('page'))
  const parPage = Number(params.get('par_page'))
  const ordre = params.get('ordre') === 'desc' ? 'desc' : 'asc'

  return {
    domaines: params.getAll('domaine').filter(Boolean),
    organismes: params.getAll('organisme').filter(Boolean),
    ville: params.get('ville') ?? '',
    du: params.get('du') ?? '',
    au: params.get('au') ?? '',
    q: params.get('q') ?? '',
    duree_max: Number.isFinite(dureeMax) && dureeMax > 0 ? dureeMax : null,
    passees: bool('passees', DEFAUTS.passees),
    permanentes: bool('permanentes', DEFAUTS.permanentes),
    historique: bool('historique', DEFAUTS.historique),
    tri: params.get('tri') || DEFAUTS.tri,
    ordre,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    par_page: [25, 50, 100, 200].includes(parPage) ? parPage : DEFAUTS.par_page,
  }
}

/** Query string canonique : mêmes omissions que `filtres.url_liste()` côté
 *  Python, pour que les URLs des deux côtés restent comparables. */
export function versParams(f: Filtres): URLSearchParams {
  const p = new URLSearchParams()
  p.set('f', '1')
  f.domaines.forEach((v) => p.append('domaine', v))
  f.organismes.forEach((v) => p.append('organisme', v))
  if (f.ville) p.set('ville', f.ville)
  if (f.du) p.set('du', f.du)
  if (f.au) p.set('au', f.au)
  if (f.q) p.set('q', f.q)
  if (f.duree_max !== null) p.set('duree_max', String(f.duree_max))
  if (f.passees) p.set('passees', '1')
  if (f.permanentes) p.set('permanentes', '1')
  if (f.historique) p.set('historique', '1')
  if (f.tri !== DEFAUTS.tri || f.ordre !== DEFAUTS.ordre) {
    p.set('tri', f.tri)
    p.set('ordre', f.ordre)
  }
  if (f.par_page !== DEFAUTS.par_page) p.set('par_page', String(f.par_page))
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

export function versQuery(f: Filtres): string {
  return versParams(f).toString()
}

export function depuisQuery(query: string): Filtres {
  return depuisParams(new URLSearchParams(query))
}

/** Un changement de critère renvoie toujours à la page 1 : rester page 12
 *  après avoir restreint à 30 résultats donnerait une liste vide. */
export function modifier(f: Filtres, modifs: Partial<Filtres>): Filtres {
  const remetAPage1 = Object.keys(modifs).some((c) => c !== 'page')
  return { ...f, ...modifs, page: modifs.page ?? (remetAPage1 ? 1 : f.page) }
}

const CRITERES: (keyof Filtres)[] = [
  'domaines', 'organismes', 'ville', 'du', 'au', 'q', 'duree_max',
  'passees', 'permanentes', 'historique',
]

/** Nombre de critères actifs (pastille sur le bouton « Filtres »). */
export function nbCriteresActifs(f: Filtres): number {
  let n = 0
  for (const cle of CRITERES) {
    const valeur = f[cle]
    if (Array.isArray(valeur)) n += valeur.length
    else if (valeur !== DEFAUTS[cle]) n += 1
  }
  return n
}

export function auxDefauts(f: Filtres): boolean {
  return nbCriteresActifs(f) === 0
}

export type Chip = { cle: string; libelle: string; retirer: () => Filtres }

/** Filtres actifs sous forme de pastilles retirables une par une. */
export function chips(f: Filtres): Chip[] {
  const liste: Chip[] = []
  const ajouter = (cle: string, libelle: string, modifs: Partial<Filtres>) =>
    liste.push({ cle, libelle, retirer: () => modifier(f, modifs) })

  f.domaines.forEach((d) =>
    ajouter(`domaine:${d}`, d, { domaines: f.domaines.filter((v) => v !== d) }))
  f.organismes.forEach((o) =>
    ajouter(`organisme:${o}`, o, { organismes: f.organismes.filter((v) => v !== o) }))
  if (f.ville) ajouter('ville', f.ville, { ville: '' })
  if (f.q) ajouter('q', `« ${f.q} »`, { q: '' })
  if (f.du && f.au) ajouter('periode', `${dateCourte(f.du)} → ${dateCourte(f.au)}`, { du: '', au: '' })
  else if (f.du) ajouter('du', `à partir du ${dateCourte(f.du)}`, { du: '' })
  else if (f.au) ajouter('au', `jusqu'au ${dateCourte(f.au)}`, { au: '' })
  if (f.duree_max !== null) ajouter('duree', `≤ ${duree(f.duree_max)}`, { duree_max: null })
  if (f.passees) ajouter('passees', 'sessions passées incluses', { passees: false })
  if (!f.permanentes) ajouter('permanentes', 'sans les permanentes', { permanentes: true })
  if (f.historique) ajouter('historique', 'historique complet', { historique: false })
  return liste
}

/** Raccourcis de période proposés au-dessus des champs de dates. */
export const RACCOURCIS_DATES: { libelle: string; calculer: () => Partial<Filtres> }[] = [
  { libelle: '7 jours', calculer: () => ({ du: aujourdhuiIso(), au: aujourdhuiIso(7) }) },
  { libelle: '30 jours', calculer: () => ({ du: aujourdhuiIso(), au: aujourdhuiIso(30) }) },
  { libelle: '3 mois', calculer: () => ({ du: aujourdhuiIso(), au: aujourdhuiIso(90) }) },
  { libelle: 'Ce trimestre', calculer: () => {
    const d = new Date()
    const debutTrimestre = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    const finTrimestre = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0)
    const iso = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    return { du: iso(debutTrimestre), au: iso(finTrimestre) }
  } },
]

export const LIBELLES_TRI: Record<string, string> = {
  date: 'Date de début',
  formation: 'Formation',
  organisme: 'Organisme',
  ville: 'Ville',
  domaine: 'Domaine',
  duree: 'Durée',
  tarif: 'Tarif',
}
