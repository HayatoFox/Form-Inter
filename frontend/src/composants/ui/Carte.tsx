import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Carte({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-carte border border-bordure bg-surface ombre-douce',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function EnteteCarte({
  titre,
  description,
  action,
  icone,
  className,
}: {
  titre: ReactNode
  description?: ReactNode
  action?: ReactNode
  icone?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-bordure px-5 py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icone && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primaire-doux text-primaire">
            {icone}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[0.9375rem] font-semibold">{titre}</h2>
          {description && <p className="mt-0.5 text-xs text-doux">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function CorpsCarte({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('p-5', className)}>{children}</div>
}
