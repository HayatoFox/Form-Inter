import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton } from './Bouton'

/** Panneau latéral (fiche détail d'une session).
 *
 *  Ferme sur Échap et au clic sur le voile ; verrouille le défilement de la
 *  page dessous pour que la molette agisse dans le panneau. */
export function Tiroir({
  ouvert,
  onFermer,
  titre,
  soustitre,
  pied,
  children,
  largeur = 'max-w-xl',
}: {
  ouvert: boolean
  onFermer: () => void
  titre: ReactNode
  soustitre?: ReactNode
  pied?: ReactNode
  children: ReactNode
  largeur?: string
}) {
  useEffect(() => {
    if (!ouvert) return
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
  }, [ouvert, onFermer])

  if (!ouvert) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-apparition bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onFermer}
      />
      <div
        className={cn(
          'relative flex h-full w-full flex-col animate-glissement border-l border-bordure bg-surface ombre-flottante',
          largeur,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-bordure px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug text-texte">{titre}</h2>
            {soustitre && <div className="mt-1 text-xs text-doux">{soustitre}</div>}
          </div>
          <Bouton
            variante="discret"
            taille="icone"
            onClick={onFermer}
            aria-label="Fermer le panneau"
            className="-mr-1.5 shrink-0"
          >
            <X className="size-4" />
          </Bouton>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {pied && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-bordure bg-surface-2 px-5 py-3">
            {pied}
          </div>
        )}
      </div>
    </div>
  )
}
