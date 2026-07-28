import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CalendarClock, CalendarRange, Building2, Download, MapPin, SearchX,
  SlidersHorizontal, Search, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { depuis, nombre } from '@/lib/format'
import type { Facettes, Filtres, PageSessions, Resume, Session } from '@/lib/types'
import { LIBELLES_TRI, depuisParams, modifier, nbCriteresActifs, versParams, versQuery } from '@/lib/filtres'
import { useSession } from '@/contexte/Session'
import { EntetePage } from '@/composants/Layout'
import { Bouton, BoutonTelechargement } from '@/composants/ui/Bouton'
import { Carte } from '@/composants/ui/Carte'
import { Liste } from '@/composants/ui/Champ'
import { EtatVide, Tuile } from '@/composants/ui/Divers'
import { ChipsFiltres, PanneauFiltres } from '@/sessions/PanneauFiltres'
import { Pagination, SqueletteTableau, TableauSessions } from '@/sessions/TableauSessions'
import { TiroirSession } from '@/sessions/TiroirSession'
import { ModaleCorrection } from '@/sessions/ModaleCorrection'
import { VuesEnregistrees } from '@/sessions/VuesEnregistrees'

export function Sessions() {
  const { utilisateur } = useSession()
  const [params, setParams] = useSearchParams()
  const filtres = useMemo(() => depuisParams(params), [params])

  const [panneauOuvert, setPanneauOuvert] = useState(false)
  const [selection, setSelection] = useState<Session | null>(null)
  const [correction, setCorrection] = useState<Session | null>(null)

  const appliquer = useCallback(
    (suivants: Filtres) => setParams(versParams(suivants), { replace: true }),
    [setParams],
  )

  const query = versQuery(filtres)
  const { data, isPending, isFetching } = useQuery({
    queryKey: ['sessions', query],
    queryFn: () => api.get<PageSessions>(`/api/sessions?${query}`),
    placeholderData: keepPreviousData,
  })
  const { data: facettes } = useQuery({
    queryKey: ['facettes'],
    queryFn: () => api.get<Facettes>('/api/facettes'),
    staleTime: 5 * 60_000,
  })
  const { data: resume } = useQuery({
    queryKey: ['resume'],
    queryFn: () => api.get<Resume>('/api/resume'),
    staleTime: 5 * 60_000,
  })

  const nbFiltres = nbCriteresActifs(filtres)

  return (
    <>
      <EntetePage
        titre="Sessions de formation"
        description={
          resume
            ? `Offre courante de ${nombre(resume.organismes)} organismes — dernière collecte ${depuis(resume.derniere_collecte)}.`
            : 'Offre courante des organismes suivis.'
        }
        actions={
          <>
            <BoutonTelechargement href={data?.export_csv ?? '/export.csv'} variante="secondaire">
              <Download className="size-4" aria-hidden />
              CSV
            </BoutonTelechargement>
            <BoutonTelechargement href={data?.export_xlsx ?? '/export.xlsx'} variante="primaire">
              <Download className="size-4" aria-hidden />
              Excel
            </BoutonTelechargement>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile
          libelle="Sessions à venir"
          valeur={resume ? nombre(resume.a_venir) : '—'}
          icone={<CalendarRange className="size-3.5" aria-hidden />}
          ton="primaire"
        />
        <Tuile
          libelle="Dans les 30 jours"
          valeur={resume ? nombre(resume.sous_30_jours) : '—'}
          icone={<CalendarClock className="size-3.5" aria-hidden />}
          ton="accent"
        />
        <Tuile
          libelle="Villes couvertes"
          valeur={resume ? nombre(resume.villes) : '—'}
          icone={<MapPin className="size-3.5" aria-hidden />}
        />
        <Tuile
          libelle="Organismes suivis"
          valeur={resume ? nombre(resume.organismes) : '—'}
          icone={<Building2 className="size-3.5" aria-hidden />}
        />
      </div>

      <div className="mb-4">
        <VuesEnregistrees filtres={filtres} onFiltres={appliquer} />
      </div>

      <Carte className="overflow-visible">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <ChampRecherche filtres={filtres} onFiltres={appliquer} />

          <Bouton
            variante={panneauOuvert || nbFiltres ? 'primaire' : 'secondaire'}
            onClick={() => setPanneauOuvert((o) => !o)}
            aria-expanded={panneauOuvert}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtres
            {nbFiltres > 0 && (
              <span
                className={cn(
                  'chiffres rounded px-1.5 text-[0.6875rem] font-bold',
                  panneauOuvert || nbFiltres
                    ? 'bg-white/25 sombre:bg-black/20'
                    : 'bg-primaire-doux text-primaire',
                )}
              >
                {nbFiltres}
              </span>
            )}
          </Bouton>

          <div className="ml-auto flex items-center gap-2">
            <Liste
              aria-label="Trier par"
              value={`${filtres.tri}:${filtres.ordre}`}
              onChange={(e) => {
                const [tri, ordre] = e.target.value.split(':')
                appliquer(modifier(filtres, { tri, ordre: ordre as 'asc' | 'desc' }))
              }}
              className="hidden h-9 w-44 text-xs sm:block"
            >
              {Object.entries(LIBELLES_TRI).map(([cle, libelle]) => (
                <optgroup key={cle} label={libelle}>
                  <option value={`${cle}:asc`}>{libelle} ↑</option>
                  <option value={`${cle}:desc`}>{libelle} ↓</option>
                </optgroup>
              ))}
            </Liste>
            <Liste
              aria-label="Résultats par page"
              value={filtres.par_page}
              onChange={(e) => appliquer(modifier(filtres, { par_page: Number(e.target.value) }))}
              className="h-9 w-24 text-xs"
            >
              {(facettes?.par_page_choix ?? [25, 50, 100, 200]).map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </Liste>
          </div>
        </div>

        {panneauOuvert && (
          <PanneauFiltres filtres={filtres} onFiltres={appliquer} facettes={facettes} />
        )}
        <ChipsFiltres filtres={filtres} onFiltres={appliquer} />

        <div className="border-t border-bordure">
          {isPending ? (
            <SqueletteTableau />
          ) : data && data.lignes.length > 0 ? (
            <TableauSessions
              lignes={data.lignes}
              filtres={filtres}
              onFiltres={appliquer}
              onOuvrir={setSelection}
              chargement={isFetching}
              idSelectionne={selection?.id ?? null}
            />
          ) : (
            <EtatVide
              icone={<SearchX className="size-5" aria-hidden />}
              titre="Aucune session ne correspond"
              description="Élargissez la période, retirez un domaine, ou cochez « sessions passées » pour retrouver d’anciennes dates."
              action={
                nbFiltres > 0 ? (
                  <Bouton variante="secondaire" onClick={() => setParams(new URLSearchParams())}>
                    Réinitialiser les filtres
                  </Bouton>
                ) : undefined
              }
            />
          )}
        </div>

        {data && data.lignes.length > 0 && (
          <div className="border-t border-bordure">
            <Pagination
              page={data.page}
              nbPages={data.nb_pages}
              total={data.total}
              parPage={data.par_page}
              onPage={(page) => {
                appliquer(modifier(filtres, { page }))
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        )}
      </Carte>

      <TiroirSession
        session={selection}
        onFermer={() => setSelection(null)}
        peutCorriger={Boolean(utilisateur?.admin)}
        onCorriger={(s) => {
          setSelection(null)
          setCorrection(s)
        }}
      />
      <ModaleCorrection session={correction} onFermer={() => setCorrection(null)} />
    </>
  )
}

/** Recherche plein texte, appliquée après une courte pause de frappe pour
 *  ne pas lancer une requête par caractère. */
function ChampRecherche({
  filtres,
  onFiltres,
}: {
  filtres: Filtres
  onFiltres: (f: Filtres) => void
}) {
  const [texte, setTexte] = useState(filtres.q)
  const champ = useRef<HTMLInputElement>(null)
  const derniereValeur = useRef(filtres.q)

  // Resynchronisation quand les filtres changent ailleurs (vue enregistrée,
  // bouton Retour du navigateur, chip retirée).
  useEffect(() => {
    if (filtres.q !== derniereValeur.current) {
      derniereValeur.current = filtres.q
      setTexte(filtres.q)
    }
  }, [filtres.q])

  useEffect(() => {
    if (texte === filtres.q) return
    const minuteur = setTimeout(() => {
      derniereValeur.current = texte
      onFiltres(modifier(filtres, { q: texte }))
    }, 280)
    return () => clearTimeout(minuteur)
  }, [texte, filtres, onFiltres])

  // « / » met le curseur dans la recherche, comme dans les outils de dev.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement
      const dansUnChamp = ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)
      if (e.key === '/' && !dansUnChamp) {
        e.preventDefault()
        champ.current?.focus()
      }
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [])

  return (
    <div className="relative min-w-56 flex-1 sm:max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faible"
        aria-hidden
      />
      <input
        ref={champ}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Rechercher un intitulé, une ville, une remarque…"
        aria-label="Rechercher"
        className={cn(
          'h-9 w-full rounded-lg border border-bordure-forte/70 bg-surface pl-9 pr-16 text-sm',
          'placeholder:text-faible hover:border-bordure-forte focus:border-primaire',
          'focus:outline-none focus:ring-2 focus:ring-primaire/25',
        )}
      />
      {texte ? (
        <button
          onClick={() => setTexte('')}
          aria-label="Effacer la recherche"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-faible transition-colors hover:text-texte"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-bordure bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-medium text-faible sm:block">
          /
        </kbd>
      )}
    </div>
  )
}
