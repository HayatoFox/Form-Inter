import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarClock, CalendarRange, History, Infinity as Infini, Layers, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { cn, classeDomaine } from '@/lib/utils'
import { moisLisible, nombre } from '@/lib/format'
import type { Facette, Stats } from '@/lib/types'
import { EntetePage } from '@/composants/Layout'
import { Carte, EnteteCarte } from '@/composants/ui/Carte'
import { Barre, Chargement, Tuile } from '@/composants/ui/Divers'

function Repartition({
  titre,
  description,
  icone,
  donnees,
  couleurDomaine,
}: {
  titre: string
  description?: string
  icone: React.ReactNode
  donnees: Facette[]
  couleurDomaine?: boolean
}) {
  const maxi = Math.max(1, ...donnees.map((d) => d.nb))
  const total = donnees.reduce((somme, d) => somme + d.nb, 0)

  return (
    <Carte className="overflow-hidden">
      <EnteteCarte icone={icone} titre={titre} description={description} />
      <ul className="divide-y divide-bordure/70">
        {donnees.map((d) => (
          <li key={d.valeur ?? 'non-renseigne'} className="px-5 py-2.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {couleurDomaine && (
                  <span
                    className={cn('size-2.5 shrink-0 rounded-full border', classeDomaine(d.valeur))}
                  />
                )}
                <span className="truncate text-sm">
                  {d.valeur ?? <em className="text-faible">non renseigné</em>}
                </span>
              </span>
              <span className="chiffres shrink-0 text-xs text-doux">
                <span className="font-medium text-texte">{nombre(d.nb)}</span>
                {total > 0 && (
                  <span className="text-faible"> · {Math.round((d.nb / total) * 100)} %</span>
                )}
              </span>
            </div>
            <Barre part={d.nb / maxi} />
          </li>
        ))}
      </ul>
    </Carte>
  )
}

/** Histogramme des sessions à venir par mois : lit d'un coup d'œil les
 *  périodes creuses et les pics de l'offre. */
function Calendrier({ donnees }: { donnees: { mois: string; nb: number }[] }) {
  const maxi = Math.max(1, ...donnees.map((d) => d.nb))
  // Hauteur des barres calculée en pixels : un pourcentage ne se résout pas
  // dans un parent flex de hauteur automatique (les barres restaient à zéro).
  const HAUTEUR_MAX = 150

  return (
    <Carte className="overflow-hidden">
      <EnteteCarte
        icone={<CalendarClock className="size-4" aria-hidden />}
        titre="Sessions à venir par mois"
        description="Répartition de l’offre datée sur les 18 prochains mois."
      />
      <div className="flex items-end gap-1.5 overflow-x-auto px-5 pb-4 pt-5">
        {donnees.map((d) => (
          <div key={d.mois} className="group flex min-w-10 flex-1 flex-col items-center gap-1.5">
            <span className="chiffres text-[0.6875rem] font-medium text-doux">
              {nombre(d.nb)}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-primaire to-primaire-vif transition-opacity group-hover:opacity-75"
              style={{ height: `${Math.max(4, Math.round((d.nb / maxi) * HAUTEUR_MAX))}px` }}
              title={`${moisLisible(d.mois)} : ${nombre(d.nb)} sessions`}
            />
            <span className="w-full truncate text-center text-[0.625rem] text-faible">
              {moisLisible(d.mois)}
            </span>
          </div>
        ))}
      </div>
    </Carte>
  )
}

export function Statistiques() {
  const { data, isPending } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/api/admin/stats'),
  })

  if (isPending || !data) {
    return (
      <>
        <EntetePage titre="Statistiques" />
        <Chargement />
      </>
    )
  }

  return (
    <>
      <EntetePage
        titre="Statistiques"
        description="Offre courante, sessions non masquées — corrections de l’équipe appliquées."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile
          libelle="Sessions en base"
          valeur={nombre(data.total)}
          icone={<Layers className="size-3.5" aria-hidden />}
        />
        <Tuile
          libelle="À venir"
          valeur={nombre(data.a_venir)}
          icone={<CalendarRange className="size-3.5" aria-hidden />}
          ton="primaire"
        />
        <Tuile
          libelle="Permanentes"
          valeur={nombre(data.permanentes)}
          detail="Entrée / sortie en continu"
          icone={<Infini className="size-3.5" aria-hidden />}
          ton="accent"
        />
        <Tuile
          libelle="Passées"
          valeur={nombre(data.passees)}
          detail="Conservées pour l’historique"
          icone={<History className="size-3.5" aria-hidden />}
        />
      </div>

      {data.par_mois.length > 0 && (
        <div className="mb-5">
          <Calendrier donnees={data.par_mois} />
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Repartition
          titre="Par domaine"
          description="Classification commune inter-organismes."
          icone={<Layers className="size-4" aria-hidden />}
          donnees={data.par_domaine}
          couleurDomaine
        />
        <div className="space-y-5">
          <Repartition
            titre="Par organisme"
            icone={<Building2 className="size-4" aria-hidden />}
            donnees={data.par_organisme}
          />
          <Repartition
            titre="Par ville"
            description="15 villes les mieux servies."
            icone={<MapPin className="size-4" aria-hidden />}
            donnees={data.par_ville}
          />
        </div>
      </div>
    </>
  )
}
