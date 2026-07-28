import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn, contient } from '@/lib/utils'
import type { Facette } from '@/lib/types'

/** Sélecteur multi-valeurs avec recherche.
 *
 *  Remplace les `<select multiple size=5>` d'origine, inutilisables dès
 *  qu'il y a 45 villes : ici on tape trois lettres, on coche, et le nombre
 *  de sessions par valeur est affiché pour éviter les filtres vides. */
export function ComboMulti({
  options,
  valeurs,
  onChange,
  placeholder,
  rechercheVide = 'Aucun résultat.',
  className,
}: {
  options: Facette[]
  valeurs: string[]
  onChange: (valeurs: string[]) => void
  placeholder: string
  rechercheVide?: string
  className?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const conteneur = useRef<HTMLDivElement>(null)
  const champRecherche = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ouvert) return
    champRecherche.current?.focus()
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false)
    }
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', auClic)
    document.addEventListener('keydown', auClavier)
    return () => {
      document.removeEventListener('mousedown', auClic)
      document.removeEventListener('keydown', auClavier)
    }
  }, [ouvert])

  const filtrees = useMemo(
    () => (recherche ? options.filter((o) => contient(o.valeur, recherche)) : options),
    [options, recherche],
  )

  const basculer = (valeur: string) =>
    onChange(
      valeurs.includes(valeur) ? valeurs.filter((v) => v !== valeur) : [...valeurs, valeur],
    )

  const resume =
    valeurs.length === 0
      ? placeholder
      : valeurs.length === 1
        ? valeurs[0]
        : `${valeurs.length} sélectionnés`

  return (
    <div ref={conteneur} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-sm',
          'transition-colors hover:border-bordure-forte',
          valeurs.length ? 'border-primaire/40 text-texte' : 'border-bordure-forte/70 text-faible',
          ouvert && 'border-primaire ring-2 ring-primaire/25',
        )}
      >
        <span className="truncate">{resume}</span>
        <span className="flex shrink-0 items-center gap-1">
          {valeurs.length > 1 && (
            <span className="rounded bg-primaire-doux px-1.5 py-px text-[0.6875rem] font-semibold text-primaire">
              {valeurs.length}
            </span>
          )}
          <ChevronDown
            className={cn('size-4 text-faible transition-transform', ouvert && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>

      {ouvert && (
        <div className="absolute z-30 mt-1.5 w-full min-w-56 animate-montee overflow-hidden rounded-xl border border-bordure bg-surface ombre-flottante">
          <div className="flex items-center gap-2 border-b border-bordure px-3">
            <Search className="size-3.5 shrink-0 text-faible" aria-hidden />
            <input
              ref={champRecherche}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-faible"
            />
            {recherche && (
              <button
                type="button"
                onClick={() => setRecherche('')}
                className="text-faible hover:text-texte"
                aria-label="Effacer la recherche"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filtrees.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-faible">{rechercheVide}</p>
            )}
            {filtrees.map((option) => {
              const choisi = valeurs.includes(option.valeur)
              return (
                <button
                  type="button"
                  key={option.valeur}
                  onClick={() => basculer(option.valeur)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm',
                    'transition-colors hover:bg-surface-2',
                    choisi && 'bg-primaire-doux/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border',
                      choisi
                        ? 'border-primaire bg-primaire text-white'
                        : 'border-bordure-forte',
                    )}
                  >
                    {choisi && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.valeur}</span>
                  <span className="chiffres shrink-0 text-[0.6875rem] text-faible">
                    {option.nb}
                  </span>
                </button>
              )
            })}
          </div>

          {valeurs.length > 0 && (
            <div className="border-t border-bordure px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-md px-2 py-1 text-left text-xs text-doux transition-colors hover:bg-surface-2 hover:text-texte"
              >
                Tout décocher
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
