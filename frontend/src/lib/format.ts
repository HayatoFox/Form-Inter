/** Formatage des valeurs métier pour l'affichage (français, fuseau local). */

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Les dates de la base sont des jours ISO sans fuseau : on les découpe à la
 *  main plutôt que via Date(), qui les interpréterait en UTC et décalerait
 *  l'affichage d'un jour selon l'heure locale. */
function morceaux(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function dateCourte(iso: string | null): string {
  if (!iso) return ''
  const p = morceaux(iso)
  if (!p) return iso
  return `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}`
}

export function dateLisible(iso: string | null): string {
  if (!iso) return ''
  const p = morceaux(iso)
  if (!p) return iso
  return `${p[2]} ${MOIS[p[1] - 1]} ${p[0]}`
}

/** « 12 → 16 oct. 2026 », « 3 nov. 2026 », « 29 déc. 2026 → 2 janv. 2027 ». */
export function periode(debut: string | null, fin: string | null): string {
  if (!debut) return ''
  const d = morceaux(debut)
  if (!d) return debut
  const f = fin ? morceaux(fin) : null
  if (!f || (f[0] === d[0] && f[1] === d[1] && f[2] === d[2])) {
    return `${d[2]} ${MOIS_COURT[d[1] - 1]} ${d[0]}`
  }
  if (f[0] === d[0] && f[1] === d[1]) {
    return `${d[2]} → ${f[2]} ${MOIS_COURT[f[1] - 1]} ${f[0]}`
  }
  if (f[0] === d[0]) {
    return `${d[2]} ${MOIS_COURT[d[1] - 1]} → ${f[2]} ${MOIS_COURT[f[1] - 1]} ${f[0]}`
  }
  return `${d[2]} ${MOIS_COURT[d[1] - 1]} ${d[0]} → ${f[2]} ${MOIS_COURT[f[1] - 1]} ${f[0]}`
}

export function moisLisible(mois: string): string {
  const p = /^(\d{4})-(\d{2})$/.exec(mois)
  return p ? `${MOIS_COURT[Number(p[2]) - 1]} ${p[1]}` : mois
}

export function dateHeure(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]} à ${m[4]}h${m[5]}`
}

/** « il y a 3 h », « hier », « il y a 4 j » — pour les horodatages de scrape. */
export function depuis(iso: string | null): string {
  if (!iso) return 'jamais'
  const quand = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`)
  if (Number.isNaN(quand.getTime())) return iso
  const minutes = Math.floor((Date.now() - quand.getTime()) / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.floor(heures / 24)
  if (jours === 1) return 'hier'
  if (jours < 31) return `il y a ${jours} j`
  const mois = Math.floor(jours / 30)
  return mois < 12 ? `il y a ${mois} mois` : `il y a ${Math.floor(mois / 12)} an(s)`
}

/** Nombre de jours entre aujourd'hui et une date ISO (négatif = passé). */
export function joursAvant(iso: string | null): number | null {
  if (!iso) return null
  const p = morceaux(iso)
  if (!p) return null
  const cible = new Date(p[0], p[1] - 1, p[2])
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  return Math.round((cible.getTime() - aujourdhui.getTime()) / 86400000)
}

export function duree(jours: number | null): string {
  if (jours === null || jours === undefined) return ''
  if (jours === 0.5) return '½ j'
  const arrondi = Number.isInteger(jours) ? jours : Number(jours.toFixed(1))
  return `${String(arrondi).replace('.', ',')} j`
}

export function nombre(n: number): string {
  return n.toLocaleString('fr-FR').replace(/ | /g, ' ')
}

export function pluriel(n: number, singulier: string, plurielMot?: string): string {
  return `${nombre(n)} ${n > 1 ? (plurielMot ?? `${singulier}s`) : singulier}`
}

export function secondes(s: number | null): string {
  if (s === null || s === undefined) return ''
  if (s < 60) return `${Math.round(s)} s`
  const minutes = Math.floor(s / 60)
  return `${minutes} min ${String(Math.round(s % 60)).padStart(2, '0')} s`
}

/** Aujourd'hui au format ISO local (pour les valeurs par défaut des champs date). */
export function aujourdhuiIso(decalageJours = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + decalageJours)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
