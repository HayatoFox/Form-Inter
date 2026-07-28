import { ArrowDown, ArrowUp, ChevronsUpDown, Infinity as Infini, MessageSquareText, NotebookPen, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { duree as formatDuree, joursAvant, nombre, periode } from '@/lib/format'
import type { Filtres, Session } from '@/lib/types'
import { modifier } from '@/lib/filtres'
import { EtiquetteDomaine } from '@/composants/ui/Etiquette'
import { Squelette } from '@/composants/ui/Divers'

// Largeurs fixes sauf « Formation », qui absorbe la place restante : c'est la
// colonne qu'on lit en premier, elle ne doit jamais être la plus étroite.
// (Nécessite table-fixed, sinon le navigateur redistribue à sa façon.)
const COLONNES: { cle: string | null; libelle: string; classe?: string }[] = [
  { cle: 'domaine', libelle: 'Domaine', classe: 'w-[10.5rem]' },
  { cle: 'formation', libelle: 'Formation' },
  { cle: 'organisme', libelle: 'Organisme', classe: 'w-[8.5rem]' },
  { cle: 'ville', libelle: 'Ville', classe: 'w-[7.5rem]' },
  { cle: 'date', libelle: 'Période', classe: 'w-[10rem]' },
  { cle: 'duree', libelle: 'Durée', classe: 'w-[5.25rem]' },
  { cle: 'tarif', libelle: 'Tarif', classe: 'w-[8rem]' },
]

function EnteteTriable({
  colonne,
  filtres,
  onFiltres,
}: {
  colonne: (typeof COLONNES)[number]
  filtres: Filtres
  onFiltres: (f: Filtres) => void
}) {
  if (!colonne.cle) {
    return <th className={cn('px-3 py-2.5 text-left', colonne.classe)}>{colonne.libelle}</th>
  }
  const actif = filtres.tri === colonne.cle
  const Icone = !actif ? ChevronsUpDown : filtres.ordre === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cn('p-0 text-left', colonne.classe)}>
      <button
        onClick={() =>
          onFiltres(
            modifier(filtres, {
              tri: colonne.cle!,
              ordre: actif && filtres.ordre === 'asc' ? 'desc' : 'asc',
            }),
          )
        }
        className={cn(
          'group flex w-full items-center gap-1.5 px-3 py-2.5 text-left transition-colors hover:text-texte',
          actif ? 'text-primaire' : 'text-doux',
        )}
      >
        <span className="truncate">{colonne.libelle}</span>
        <Icone
          className={cn(
            'size-3 shrink-0 transition-opacity',
            actif ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
          )}
          aria-hidden
        />
      </button>
    </th>
  )
}

/** Repère visuel d'imminence : « dans 4 j » sur les sessions proches. */
function Imminence({ session }: { session: Session }) {
  const jours = joursAvant(session.date_debut)
  if (jours === null) return null
  if (jours < 0) {
    // Déjà commencée mais pas terminée : l'information utile est « en cours ».
    const joursFin = joursAvant(session.date_fin)
    if (joursFin === null || joursFin < 0) return null
    return (
      <span className="mt-0.5 inline-block rounded bg-succes-doux px-1 py-px text-[0.625rem] font-semibold text-succes">
        en cours
      </span>
    )
  }
  if (jours > 21) return null
  return (
    <span
      className={cn(
        'mt-0.5 inline-block rounded px-1 py-px text-[0.625rem] font-semibold',
        jours <= 7
          ? 'bg-accent-50 text-accent-700 sombre:bg-accent-900/30 sombre:text-accent-300'
          : 'bg-surface-3 text-faible',
      )}
    >
      {jours === 0 ? "aujourd'hui" : jours === 1 ? 'demain' : `dans ${jours} j`}
    </span>
  )
}

function Marqueurs({ session }: { session: Session }) {
  const alerteDispo = session.disponibilite?.toLowerCase().includes('dernières')
  const complet = session.disponibilite?.toLowerCase().includes('complet')
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {session.remarque && (
        <MessageSquareText
          className="size-3.5 shrink-0 text-faible"
          aria-label="Remarque"
        />
      )}
      {session.note_interne && (
        <NotebookPen
          className="size-3.5 shrink-0 text-accent-500"
          aria-label="Note interne"
        />
      )}
      {(alerteDispo || complet) && (
        <TriangleAlert
          className={cn('size-3.5 shrink-0', complet ? 'text-erreur' : 'text-alerte')}
          aria-label={session.disponibilite ?? ''}
        />
      )}
    </span>
  )
}

function CellulePeriode({ session }: { session: Session }) {
  if (session.permanente) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-primaire-doux px-1.5 py-0.5 text-[0.6875rem] font-medium text-primaire">
        <Infini className="size-3" aria-hidden />
        permanente
      </span>
    )
  }
  return (
    <span className="block">
      <span className="block whitespace-nowrap">
        {periode(session.date_debut, session.date_fin)}
      </span>
      <Imminence session={session} />
    </span>
  )
}

export function TableauSessions({
  lignes,
  filtres,
  onFiltres,
  onOuvrir,
  chargement,
  idSelectionne,
}: {
  lignes: Session[]
  filtres: Filtres
  onFiltres: (f: Filtres) => void
  onOuvrir: (session: Session) => void
  chargement?: boolean
  idSelectionne?: number | null
}) {
  return (
    <>
      {/* Tableau à partir de lg : l'en-tête reste collé en haut au défilement */}
      <table className="hidden w-full table-fixed border-collapse lg:table">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-doux [&>th]:border-b [&>th]:border-bordure">
            {COLONNES.map((c) => (
              <EnteteTriable key={c.libelle} colonne={c} filtres={filtres} onFiltres={onFiltres} />
            ))}
          </tr>
        </thead>
        <tbody className={cn(chargement && 'opacity-50 transition-opacity')}>
          {lignes.map((s) => (
            <tr
              key={s.id}
              onClick={() => onOuvrir(s)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOuvrir(s)
                }
              }}
              className={cn(
                'cursor-pointer border-b border-bordure/70 transition-colors',
                'hover:bg-primaire-doux/45 focus-visible:bg-primaire-doux/45',
                idSelectionne === s.id && 'bg-primaire-doux/70',
              )}
            >
              {/* overflow-hidden : en table-fixed le contenu d'une cellule
                  déborde visuellement sur la colonne voisine sans ça. */}
              <td className="overflow-hidden px-3 py-2.5 align-top">
                <EtiquetteDomaine domaine={s.domaine} className="max-w-full" />
              </td>
              <td className="overflow-hidden px-3 py-2.5 align-top">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate font-medium text-texte" title={s.formation}>
                    {s.formation}
                  </span>
                  <Marqueurs session={s} />
                </span>
                {s.type_formation && (
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-faible">
                    {s.type_formation}
                  </span>
                )}
              </td>
              <td className="overflow-hidden px-3 py-2.5 align-top text-doux">
                <span className="block truncate">{s.organisme}</span>
              </td>
              <td className="overflow-hidden px-3 py-2.5 align-top text-doux">
                <span className="block truncate">{s.ville}</span>
              </td>
              <td className="px-3 py-2.5 align-top text-doux">
                <CellulePeriode session={s} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 align-top text-doux">
                {formatDuree(s.duree_jours)}
              </td>
              <td className="overflow-hidden px-3 py-2.5 align-top text-[0.8125rem] text-doux">
                <span className="block truncate" title={s.tarif ?? ''}>
                  {s.tarif ?? <span className="text-faible">—</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cartes en dessous de lg : un tableau à 7 colonnes est illisible sur
          un téléphone, on repasse sur une liste empilée. */}
      <ul className={cn('divide-y divide-bordure lg:hidden', chargement && 'opacity-50')}>
        {lignes.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onOuvrir(s)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <EtiquetteDomaine domaine={s.domaine} />
                <span className="shrink-0 text-[0.6875rem] text-faible">{s.organisme}</span>
              </div>
              <p className="mt-1.5 flex items-baseline gap-1.5 font-medium">
                <span className="min-w-0 flex-1">{s.formation}</span>
                <Marqueurs session={s} />
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-doux">
                <span>{s.ville}</span>
                <span className="text-faible">·</span>
                <CellulePeriode session={s} />
                {s.duree_jours !== null && (
                  <>
                    <span className="text-faible">·</span>
                    <span>{formatDuree(s.duree_jours)}</span>
                  </>
                )}
              </p>
              {s.tarif && <p className="mt-1 text-xs text-faible">{s.tarif}</p>}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function SqueletteTableau({ lignes = 8 }: { lignes?: number }) {
  return (
    <div className="divide-y divide-bordure">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Squelette className="h-5 w-28 shrink-0" />
          <Squelette className="h-4 flex-1" />
          <Squelette className="hidden h-4 w-24 shrink-0 sm:block" />
          <Squelette className="hidden h-4 w-32 shrink-0 md:block" />
        </div>
      ))}
    </div>
  )
}

export function Pagination({
  page,
  nbPages,
  total,
  parPage,
  onPage,
}: {
  page: number
  nbPages: number
  total: number
  parPage: number
  onPage: (page: number) => void
}) {
  if (nbPages <= 1) {
    return (
      <p className="px-4 py-3 text-xs text-doux">
        {nombre(total)} résultat{total > 1 ? 's' : ''}
      </p>
    )
  }
  const premier = (page - 1) * parPage + 1
  const dernier = Math.min(page * parPage, total)

  // Fenêtre de pages autour de la page courante, avec les extrémités.
  const pages: (number | '…')[] = []
  const ajouter = (n: number) => !pages.includes(n) && pages.push(n)
  ajouter(1)
  if (page > 3) pages.push('…')
  for (let n = Math.max(2, page - 1); n <= Math.min(nbPages - 1, page + 1); n++) ajouter(n)
  if (page < nbPages - 2) pages.push('…')
  if (nbPages > 1) ajouter(nbPages)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-xs text-doux">
        <span className="chiffres font-medium text-texte">
          {nombre(premier)}–{nombre(dernier)}
        </span>{' '}
        sur <span className="chiffres font-medium text-texte">{nombre(total)}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-doux transition-colors hover:bg-surface-2 hover:text-texte disabled:pointer-events-none disabled:opacity-40"
        >
          Précédent
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-xs text-faible">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'chiffres min-w-8 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                p === page
                  ? 'bg-primaire text-white sombre:text-[#04121c]'
                  : 'text-doux hover:bg-surface-2 hover:text-texte',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === nbPages}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-doux transition-colors hover:bg-surface-2 hover:text-texte disabled:pointer-events-none disabled:opacity-40"
        >
          Suivant
        </button>
      </nav>
    </div>
  )
}
