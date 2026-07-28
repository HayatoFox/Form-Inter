import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const CHAMP =
  'h-9 w-full rounded-lg border border-bordure-forte/70 bg-surface px-3 text-sm text-texte ' +
  'placeholder:text-faible transition-colors ' +
  'hover:border-bordure-forte focus:border-primaire focus:outline-none ' +
  'focus:ring-2 focus:ring-primaire/25 disabled:opacity-60'

export const Champ = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Champ({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CHAMP, className)} {...props} />
  },
)

export const Liste = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Liste({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          CHAMP,
          'cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)

/** Libellé + champ, avec aide optionnelle. `htmlFor` est câblé tout seul. */
export function Groupe({
  libelle,
  aide,
  children,
  className,
}: {
  libelle: ReactNode
  aide?: ReactNode
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-medium text-doux">
        {libelle}
      </label>
      {children(id)}
      {aide && <p className="text-[0.6875rem] text-faible">{aide}</p>}
    </div>
  )
}

export function Case({
  coche,
  onChange,
  libelle,
  aide,
  className,
}: {
  coche: boolean
  onChange: (valeur: boolean) => void
  libelle: ReactNode
  aide?: string
  className?: string
}) {
  return (
    <label
      title={aide}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm',
        'transition-colors hover:bg-surface-2',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer rounded border-bordure-forte accent-[var(--primaire)]"
      />
      <span className="text-texte">{libelle}</span>
    </label>
  )
}

/** Interrupteur on/off — utilisé pour « vue partagée avec l'équipe ». */
export function Interrupteur({
  actif,
  onChange,
  libelle,
  aide,
}: {
  actif: boolean
  onChange: (valeur: boolean) => void
  libelle: ReactNode
  aide?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={actif}
        onClick={() => onChange(!actif)}
        className={cn(
          'mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          actif ? 'bg-primaire' : 'bg-bordure-forte',
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow transition-transform',
            actif ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-texte">{libelle}</span>
        {aide && <span className="block text-xs text-doux">{aide}</span>}
      </span>
    </label>
  )
}
