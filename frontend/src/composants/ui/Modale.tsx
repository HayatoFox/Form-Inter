import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton } from './Bouton'

export function Modale({
  ouverte,
  onFermer,
  titre,
  description,
  pied,
  children,
  largeur = 'max-w-lg',
}: {
  ouverte: boolean
  onFermer: () => void
  titre: ReactNode
  description?: ReactNode
  pied?: ReactNode
  children: ReactNode
  largeur?: string
}) {
  useEffect(() => {
    if (!ouverte) return
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    document.addEventListener('keydown', auClavier)
    const debordement = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', auClavier)
      document.body.style.overflow = debordement
    }
  }, [ouverte, onFermer])

  if (!ouverte) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 animate-apparition bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onFermer}
      />
      <div
        className={cn(
          'relative my-auto w-full animate-montee rounded-carte border border-bordure bg-surface ombre-flottante',
          largeur,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-bordure px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-texte">{titre}</h2>
            {description && <p className="mt-0.5 text-xs text-doux">{description}</p>}
          </div>
          <Bouton
            variante="discret"
            taille="icone"
            onClick={onFermer}
            aria-label="Fermer"
            className="-mr-1.5 shrink-0"
          >
            <X className="size-4" />
          </Bouton>
        </div>
        <div className="px-5 py-5">{children}</div>
        {pied && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-bordure bg-surface-2 px-5 py-3">
            {pied}
          </div>
        )}
      </div>
    </div>
  )
}
