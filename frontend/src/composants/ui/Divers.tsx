import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EtatVide({
  icone,
  titre,
  description,
  action,
  className,
}: {
  icone?: ReactNode
  titre: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      {icone && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-3 text-faible">
          {icone}
        </span>
      )}
      <p className="text-[0.9375rem] font-medium text-texte">{titre}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-sm text-doux">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Squelette({ className }: { className?: string }) {
  return <div className={cn('animate-pulsation rounded-md bg-surface-3', className)} />
}

export function Chargement({ libelle = 'Chargement…' }: { libelle?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-6 py-16 text-sm text-doux">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {libelle}
    </div>
  )
}

export function Encart({
  ton = 'info',
  titre,
  children,
  action,
}: {
  ton?: 'info' | 'succes' | 'alerte' | 'erreur'
  titre?: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  const tons = {
    info: 'bg-primaire-doux border-primaire/20 text-primaire',
    succes: 'bg-succes-doux border-succes/25 text-succes',
    alerte: 'bg-alerte-doux border-alerte/25 text-alerte',
    erreur: 'bg-erreur-doux border-erreur/25 text-erreur',
  }
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tons[ton])}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {titre && <p className="font-semibold">{titre}</p>}
          {children && <div className={cn(titre && 'mt-0.5', 'opacity-90')}>{children}</div>}
        </div>
        {action}
      </div>
    </div>
  )
}

/** Barre de progression horizontale des répartitions (statistiques). */
export function Barre({ part, ton = 'primaire' }: { part: number; ton?: 'primaire' | 'accent' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          ton === 'primaire'
            ? 'bg-gradient-to-r from-primaire to-primaire-vif'
            : 'bg-gradient-to-r from-accent-500 to-accent-400',
        )}
        style={{ width: `${Math.max(2, Math.round(part * 100))}%` }}
      />
    </div>
  )
}

/** Tuile de chiffre-clé (en-tête des pages Sessions et Statistiques). */
export function Tuile({
  libelle,
  valeur,
  detail,
  icone,
  ton = 'neutre',
}: {
  libelle: string
  valeur: ReactNode
  detail?: ReactNode
  icone?: ReactNode
  ton?: 'neutre' | 'primaire' | 'accent'
}) {
  const tons = {
    neutre: 'text-texte',
    primaire: 'text-primaire',
    accent: 'text-accent-600 sombre:text-accent-400',
  }
  return (
    <div className="rounded-carte border border-bordure bg-surface px-4 py-3.5 ombre-douce">
      <div className="flex items-center gap-2 text-xs font-medium text-doux">
        {icone}
        {libelle}
      </div>
      <p className={cn('chiffres mt-1.5 text-2xl font-semibold tracking-tight', tons[ton])}>
        {valeur}
      </p>
      {detail && <p className="mt-0.5 text-xs text-faible">{detail}</p>}
    </div>
  )
}
