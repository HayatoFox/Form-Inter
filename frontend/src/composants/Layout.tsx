import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity, BarChart3, CalendarRange, ChevronDown, KeyRound, LogOut, Menu,
  Monitor, Moon, PencilRuler, Sun, Users, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/contexte/Session'
import { useTheme } from '@/contexte/Theme'
import { Marque } from './Marque'
import { Bouton } from './ui/Bouton'
import { ModaleMotDePasse } from './ModaleMotDePasse'

type Entree = { vers: string; libelle: string; icone: typeof Activity; exact?: boolean }

const CONSULTATION: Entree[] = [
  { vers: '/', libelle: 'Sessions', icone: CalendarRange, exact: true },
]

const BACK_OFFICE: Entree[] = [
  { vers: '/admin', libelle: 'Santé des scrapers', icone: Activity, exact: true },
  { vers: '/admin/statistiques', libelle: 'Statistiques', icone: BarChart3 },
  { vers: '/admin/corrections', libelle: 'Corrections', icone: PencilRuler },
  { vers: '/admin/utilisateurs', libelle: 'Utilisateurs', icone: Users },
]

function LienNav({ entree, onNaviguer }: { entree: Entree; onNaviguer?: () => void }) {
  const Icone = entree.icone
  return (
    <NavLink
      to={entree.vers}
      end={entree.exact}
      onClick={onNaviguer}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primaire-doux text-primaire'
            : 'text-doux hover:bg-surface-2 hover:text-texte',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icone
            className={cn('size-4 shrink-0', isActive ? 'text-primaire' : 'text-faible')}
            aria-hidden
          />
          <span className="truncate">{entree.libelle}</span>
        </>
      )}
    </NavLink>
  )
}

function Rubrique({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-2.5 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-faible">
        {titre}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function SelecteurTheme() {
  const { theme, definir } = useTheme()
  const choix = [
    { valeur: 'clair', icone: Sun, titre: 'Thème clair' },
    { valeur: 'sombre', icone: Moon, titre: 'Thème sombre' },
    { valeur: 'systeme', icone: Monitor, titre: 'Selon le système' },
  ] as const
  return (
    <div className="flex rounded-lg border border-bordure bg-surface-2 p-0.5">
      {choix.map((c) => {
        const Icone = c.icone
        return (
          <button
            key={c.valeur}
            onClick={() => definir(c.valeur)}
            title={c.titre}
            aria-label={c.titre}
            aria-pressed={theme === c.valeur}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors',
              theme === c.valeur
                ? 'bg-surface text-primaire ombre-douce'
                : 'text-faible hover:text-doux',
            )}
          >
            <Icone className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}

function MenuUtilisateur({ onMotDePasse }: { onMotDePasse: () => void }) {
  const { utilisateur, deconnecter } = useSession()
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', auClic)
    return () => document.removeEventListener('mousedown', auClic)
  }, [ouvert])

  if (!utilisateur) return null
  const initiales = utilisateur.identifiant.slice(0, 2).toUpperCase()

  return (
    <div ref={conteneur} className="relative">
      {ouvert && (
        <div className="absolute bottom-full left-0 mb-1.5 w-full min-w-52 animate-montee overflow-hidden rounded-xl border border-bordure bg-surface p-1 ombre-flottante">
          <button
            onClick={() => {
              setOuvert(false)
              onMotDePasse()
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-doux transition-colors hover:bg-surface-2 hover:text-texte"
          >
            <KeyRound className="size-4 text-faible" aria-hidden />
            Changer mon mot de passe
          </button>
          <button
            onClick={() => void deconnecter()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-doux transition-colors hover:bg-erreur-doux hover:text-erreur"
          >
            <LogOut className="size-4" aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
      <button
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primaire text-[0.6875rem] font-bold text-white">
          {initiales}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium text-texte">
            {utilisateur.identifiant}
          </span>
          <span className="block text-[0.6875rem] text-faible">
            {utilisateur.admin ? 'Administrateur' : 'Utilisateur'}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-faible transition-transform', ouvert && 'rotate-180')}
          aria-hidden
        />
      </button>
    </div>
  )
}

function ContenuBarre({
  onNaviguer,
  onMotDePasse,
}: {
  onNaviguer?: () => void
  onMotDePasse: () => void
}) {
  const { utilisateur } = useSession()
  return (
    <>
      <div className="px-3 py-4">
        <Marque />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <Rubrique titre="Consultation">
          {CONSULTATION.map((e) => (
            <LienNav key={e.vers} entree={e} onNaviguer={onNaviguer} />
          ))}
        </Rubrique>
        {utilisateur?.admin && (
          <Rubrique titre="Back office">
            {BACK_OFFICE.map((e) => (
              <LienNav key={e.vers} entree={e} onNaviguer={onNaviguer} />
            ))}
          </Rubrique>
        )}
      </nav>
      <div className="space-y-2 border-t border-bordure px-3 py-3">
        <SelecteurTheme />
        <MenuUtilisateur onMotDePasse={onMotDePasse} />
      </div>
    </>
  )
}

export function Layout() {
  const [barreMobile, setBarreMobile] = useState(false)
  const [motDePasse, setMotDePasse] = useState(false)
  const { pathname } = useLocation()

  // Refermer le tiroir de navigation après un changement de page sur mobile.
  useEffect(() => setBarreMobile(false), [pathname])

  return (
    <div className="min-h-dvh bg-fond">
      {/* Barre latérale fixe à partir de lg */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-bordure bg-surface lg:flex">
        <ContenuBarre onMotDePasse={() => setMotDePasse(true)} />
      </aside>

      {/* Tiroir de navigation sur petit écran */}
      {barreMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-apparition bg-slate-950/40"
            onClick={() => setBarreMobile(false)}
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-bordure bg-surface ombre-flottante">
            <button
              onClick={() => setBarreMobile(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-faible hover:bg-surface-2 hover:text-texte"
              aria-label="Fermer la navigation"
            >
              <X className="size-4" />
            </button>
            <ContenuBarre
              onNaviguer={() => setBarreMobile(false)}
              onMotDePasse={() => setMotDePasse(true)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-bordure bg-surface/85 px-4 backdrop-blur lg:hidden">
          <Bouton
            variante="discret"
            taille="icone"
            onClick={() => setBarreMobile(true)}
            aria-label="Ouvrir la navigation"
          >
            <Menu className="size-5" />
          </Bouton>
          <Marque compact />
          <span className="text-sm font-semibold">PROINSEC Formations</span>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7">
          <Outlet />
        </main>
      </div>

      <ModaleMotDePasse ouverte={motDePasse} onFermer={() => setMotDePasse(false)} />
    </div>
  )
}

/** En-tête de page réutilisé par toutes les vues. */
export function EntetePage({
  titre,
  description,
  actions,
}: {
  titre: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-[1.375rem]">{titre}</h1>
        {description && <p className="mt-1 text-sm text-doux">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
