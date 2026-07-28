import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger' | 'accent'
export type Taille = 'sm' | 'md' | 'lg' | 'icone'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-100 ' +
  'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none'

const VARIANTES: Record<Variante, string> = {
  primaire:
    'bg-primaire text-white shadow-douce hover:bg-primaire-vif ' +
    'sombre:text-[#04121c] sombre:font-semibold',
  secondaire:
    'bg-surface text-texte border border-bordure-forte/70 shadow-douce ' +
    'hover:bg-surface-2 hover:border-bordure-forte',
  discret: 'text-doux hover:bg-surface-3 hover:text-texte',
  danger: 'bg-erreur text-white hover:brightness-110 sombre:text-[#2a0d0f]',
  accent: 'bg-accent-500 text-white hover:bg-accent-600',
}

const TAILLES: Record<Taille, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-[0.9375rem]',
  icone: 'h-9 w-9 p-0',
}

type Communs = { variante?: Variante; taille?: Taille; chargement?: boolean }

export const Bouton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & Communs
>(function Bouton(
  { className, variante = 'secondaire', taille = 'md', chargement, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || chargement}
      className={cn(BASE, VARIANTES[variante], TAILLES[taille], className)}
      {...props}
    >
      {chargement && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

/** Même apparence que Bouton, mais navigue (react-router). */
export function BoutonLien({
  className,
  variante = 'secondaire',
  taille = 'md',
  ...props
}: LinkProps & Communs) {
  return (
    <Link className={cn(BASE, VARIANTES[variante], TAILLES[taille], className)} {...props} />
  )
}

/** Lien de téléchargement (exports) : ancre native, pas de routage. */
export function BoutonTelechargement({
  className,
  variante = 'secondaire',
  taille = 'md',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & Communs) {
  return <a className={cn(BASE, VARIANTES[variante], TAILLES[taille], className)} {...props} />
}
