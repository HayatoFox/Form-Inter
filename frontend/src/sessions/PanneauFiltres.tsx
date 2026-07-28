import { RotateCcw, X } from 'lucide-react'
import type { Facettes, Filtres } from '@/lib/types'
import { DEFAUTS, RACCOURCIS_DATES, chips, modifier } from '@/lib/filtres'
import { cn } from '@/lib/utils'
import { Case, Champ, Groupe } from '@/composants/ui/Champ'
import { ComboMulti } from '@/composants/ui/ComboMulti'

export function PanneauFiltres({
  filtres,
  onFiltres,
  facettes,
}: {
  filtres: Filtres
  onFiltres: (f: Filtres) => void
  facettes?: Facettes
}) {
  const maj = (modifs: Partial<Filtres>) => onFiltres(modifier(filtres, modifs))
  const periodeActive = Boolean(filtres.du || filtres.au)

  return (
    <div className="border-t border-bordure bg-surface-2/60 px-4 py-4">
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        <Groupe libelle="Domaine">
          {() => (
            <ComboMulti
              options={facettes?.domaines ?? []}
              valeurs={filtres.domaines}
              onChange={(domaines) => maj({ domaines })}
              placeholder="Tous les domaines"
            />
          )}
        </Groupe>

        <Groupe libelle="Organisme">
          {() => (
            <ComboMulti
              options={facettes?.organismes ?? []}
              valeurs={filtres.organismes}
              onChange={(organismes) => maj({ organismes })}
              placeholder="Tous les organismes"
            />
          )}
        </Groupe>

        <Groupe libelle="Ville">
          {() => (
            <ComboMulti
              options={facettes?.villes ?? []}
              valeurs={filtres.ville ? [filtres.ville] : []}
              // Une seule ville à la fois côté API : on garde la dernière cochée.
              onChange={(villes) => maj({ ville: villes[villes.length - 1] ?? '' })}
              placeholder="Toutes les villes"
            />
          )}
        </Groupe>

        <Groupe libelle="Durée maximale" aide="En jours (½ journée = 0,5)">
          {(id) => (
            <Champ
              id={id}
              type="number"
              min={0.5}
              step={0.5}
              placeholder="Sans limite"
              value={filtres.duree_max ?? ''}
              onChange={(e) =>
                maj({ duree_max: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          )}
        </Groupe>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-doux">Période</span>
            <div className="flex flex-wrap gap-1">
              {RACCOURCIS_DATES.map((r) => (
                <button
                  key={r.libelle}
                  onClick={() => maj(r.calculer())}
                  className="rounded-md border border-bordure bg-surface px-2 py-0.5 text-[0.6875rem] font-medium text-doux transition-colors hover:border-primaire/40 hover:text-primaire"
                >
                  {r.libelle}
                </button>
              ))}
              {periodeActive && (
                <button
                  onClick={() => maj({ du: '', au: '' })}
                  className="rounded-md px-2 py-0.5 text-[0.6875rem] font-medium text-faible transition-colors hover:text-erreur"
                >
                  effacer
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Champ
              type="date"
              aria-label="Date de début minimale"
              value={filtres.du}
              min={facettes?.date_min ?? undefined}
              max={filtres.au || undefined}
              onChange={(e) => maj({ du: e.target.value })}
            />
            <Champ
              type="date"
              aria-label="Date de début maximale"
              value={filtres.au}
              min={filtres.du || undefined}
              max={facettes?.date_max ?? undefined}
              onChange={(e) => maj({ au: e.target.value })}
            />
          </div>
        </div>

        <div className="sm:col-span-2 xl:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-doux">Inclure</span>
          <div className="grid gap-0.5 sm:grid-cols-2 xl:grid-cols-3">
            <Case
              coche={filtres.permanentes}
              onChange={(permanentes) => maj({ permanentes })}
              libelle="Entrées permanentes"
              aide="Offres ouvertes en continu, sans date fixe"
            />
            <Case
              coche={filtres.passees}
              onChange={(passees) => maj({ passees })}
              libelle="Sessions passées"
            />
            <Case
              coche={filtres.historique}
              onChange={(historique) => maj({ historique })}
              libelle="Historique complet"
              aide="Inclut les sessions retirées des sites sources"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Pastilles des filtres actifs, retirables une par une. */
export function ChipsFiltres({
  filtres,
  onFiltres,
}: {
  filtres: Filtres
  onFiltres: (f: Filtres) => void
}) {
  const liste = chips(filtres)
  if (liste.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-bordure px-4 py-2.5">
      {liste.map((chip) => (
        <button
          key={chip.cle}
          onClick={() => onFiltres(chip.retirer())}
          className={cn(
            'group inline-flex max-w-full items-center gap-1 rounded-md border border-bordure bg-surface',
            'py-0.5 pl-2 pr-1 text-xs text-doux transition-colors hover:border-erreur/40 hover:text-erreur',
          )}
        >
          <span className="truncate">{chip.libelle}</span>
          <X className="size-3 shrink-0 opacity-50 group-hover:opacity-100" aria-hidden />
        </button>
      ))}
      <button
        onClick={() => onFiltres({ ...DEFAUTS, tri: filtres.tri, ordre: filtres.ordre, par_page: filtres.par_page })}
        className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-faible transition-colors hover:text-texte"
      >
        <RotateCcw className="size-3" aria-hidden />
        Tout effacer
      </button>
    </div>
  )
}
