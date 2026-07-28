import type { ReactNode } from 'react'
import { cn, classeDomaine } from '@/lib/utils'

type Ton = 'neutre' | 'primaire' | 'succes' | 'alerte' | 'erreur' | 'accent'

const TONS: Record<Ton, string> = {
  neutre: 'bg-surface-3 text-doux border-bordure',
  primaire: 'bg-primaire-doux text-primaire border-primaire/20',
  succes: 'bg-succes-doux text-succes border-succes/25',
  alerte: 'bg-alerte-doux text-alerte border-alerte/25',
  erreur: 'bg-erreur-doux text-erreur border-erreur/25',
  accent: 'bg-accent-50 text-accent-700 border-accent-200 sombre:bg-accent-900/25 sombre:text-accent-300 sombre:border-accent-700/40',
}

export function Etiquette({
  ton = 'neutre',
  className,
  children,
  titre,
}: {
  ton?: Ton
  className?: string
  children: ReactNode
  titre?: string
}) {
  return (
    <span
      title={titre}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5',
        'text-[0.6875rem] font-medium leading-4',
        TONS[ton],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Badge d'un domaine, à teinte stable (cf. classeDomaine). */
export function EtiquetteDomaine({
  domaine,
  className,
}: {
  domaine: string | null
  className?: string
}) {
  if (!domaine) return null
  return (
    // inline-block et non inline-flex : `text-overflow: ellipsis` ne
    // s'applique pas au contenu d'un conteneur flex, et les libellés longs
    // (« CACES / Conduite d'engins ») étaient coupés net, sans les points.
    <span
      title={domaine}
      className={cn(
        'inline-block max-w-full truncate rounded-md border px-1.5 py-0.5 align-middle',
        'text-[0.6875rem] font-medium leading-4',
        classeDomaine(domaine),
        className,
      )}
    >
      {domaine}
    </span>
  )
}

const PASTILLES = {
  ok: 'bg-succes',
  alerte: 'bg-alerte',
  erreur: 'bg-erreur',
} as const

export function Pastille({
  niveau,
  pulse,
  className,
}: {
  niveau: keyof typeof PASTILLES
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('relative flex size-2.5 shrink-0', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-60',
            PASTILLES[niveau],
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', PASTILLES[niveau])} />
    </span>
  )
}
