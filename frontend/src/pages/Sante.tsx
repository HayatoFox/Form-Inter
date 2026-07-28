import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown, CircleCheck, CircleX, Database, History, Play, RefreshCw, TriangleAlert,
} from 'lucide-react'
import { api, messageErreur } from '@/lib/api'
import { cn } from '@/lib/utils'
import { dateHeure, depuis, nombre, secondes } from '@/lib/format'
import type { EtatOrganisme, Niveau, Sante as SanteType } from '@/lib/types'
import { useNotifications } from '@/contexte/Notifications'
import { EntetePage } from '@/composants/Layout'
import { Bouton } from '@/composants/ui/Bouton'
import { Carte, EnteteCarte } from '@/composants/ui/Carte'
import { Etiquette, Pastille } from '@/composants/ui/Etiquette'
import { Chargement, Encart } from '@/composants/ui/Divers'

const ICONES: Record<Niveau, typeof CircleCheck> = {
  ok: CircleCheck,
  alerte: TriangleAlert,
  erreur: CircleX,
}
const TEINTES: Record<Niveau, string> = {
  ok: 'text-succes',
  alerte: 'text-alerte',
  erreur: 'text-erreur',
}

function CarteOrganisme({ etat }: { etat: EtatOrganisme }) {
  const [detailOuvert, setDetailOuvert] = useState(false)
  const Icone = ICONES[etat.niveau]
  const d = etat.dernier

  return (
    <Carte
      className={cn(
        'overflow-hidden',
        etat.niveau === 'erreur' && 'border-erreur/35',
        etat.niveau === 'alerte' && 'border-alerte/35',
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <Pastille niveau={etat.niveau} pulse={etat.niveau === 'erreur'} />
            <span className="truncate">{etat.organisme}</span>
          </p>
          <p className="chiffres mt-1 text-xs text-doux">
            {nombre(etat.nb_en_base)} sessions en base
          </p>
        </div>
        <Icone className={cn('size-5 shrink-0', TEINTES[etat.niveau])} aria-hidden />
      </div>

      <div className="border-t border-bordure bg-surface-2/60 px-4 py-3 text-xs">
        {d ? (
          <>
            <p className="text-doux">
              Dernier passage <span className="text-texte">{depuis(d.demarre_le)}</span>{' '}
              <span className="text-faible">({dateHeure(d.demarre_le)})</span>
            </p>
            <p className="chiffres mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-doux">
              <Etiquette ton={d.declencheur === 'cron' ? 'neutre' : 'primaire'}>
                {d.declencheur}
              </Etiquette>
              <span>
                {d.nb_sessions !== null ? `${nombre(d.nb_sessions)} sessions` : '— sessions'}
              </span>
              {d.duree_s !== null && (
                <>
                  <span className="text-faible">·</span>
                  <span>{secondes(d.duree_s)}</span>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-faible">Aucun passage enregistré.</p>
        )}

        {etat.alerte && (
          <p className={cn('mt-2 font-medium', TEINTES[etat.niveau])}>{etat.alerte}</p>
        )}

        {d?.statut === 'erreur' && d.message && (
          <div className="mt-2">
            <button
              onClick={() => setDetailOuvert((o) => !o)}
              className="flex items-center gap-1 font-medium text-doux transition-colors hover:text-texte"
            >
              <ChevronDown
                className={cn('size-3 transition-transform', detailOuvert && 'rotate-180')}
                aria-hidden
              />
              Détail de l’erreur
            </button>
            {detailOuvert && (
              <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[0.6875rem] leading-relaxed text-rose-200">
                {d.message}
              </pre>
            )}
          </div>
        )}
      </div>
    </Carte>
  )
}

export function Sante() {
  const { notifier } = useNotifications()
  const cache = useQueryClient()

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ['sante'],
    queryFn: () => api.get<SanteType>('/api/admin/sante'),
    // Un scrape dure ~10 min : on rafraîchit régulièrement tant qu'il tourne.
    refetchInterval: (requete) => (requete.state.data?.scrape_en_cours ? 15_000 : false),
  })

  const lancer = useMutation({
    mutationFn: () => api.post('/api/admin/scrape'),
    onSuccess: () => {
      notifier('succes', 'Scrape lancé en arrière-plan.', 'Compter une dizaine de minutes.')
      cache.invalidateQueries({ queryKey: ['sante'] })
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  const alertes = data?.organismes.filter((o) => o.niveau !== 'ok') ?? []

  return (
    <>
      <EntetePage
        titre="Santé des scrapers"
        description="État du dernier passage de chaque collecteur et alertes de volume."
        actions={
          <>
            <Bouton
              variante="secondaire"
              onClick={() => void refetch()}
              aria-label="Rafraîchir"
              chargement={isFetching && !isPending}
            >
              <RefreshCw className="size-4" aria-hidden />
              Rafraîchir
            </Bouton>
            <Bouton
              variante="primaire"
              disabled={Boolean(data?.scrape_en_cours)}
              chargement={lancer.isPending}
              onClick={() => lancer.mutate()}
            >
              <Play className="size-4" aria-hidden />
              Relancer un scrape
            </Bouton>
          </>
        }
      />

      {data?.scrape_en_cours && (
        <div className="mb-4">
          <Encart ton="info" titre={`Scrape en cours depuis ${data.scrape_en_cours}`}>
            La page se met à jour toute seule ; les nouvelles sessions
            apparaîtront au fur et à mesure.
          </Encart>
        </div>
      )}

      {alertes.length > 0 && (
        <div className="mb-4">
          <Encart
            ton={alertes.some((a) => a.niveau === 'erreur') ? 'erreur' : 'alerte'}
            titre={`${alertes.length} organisme${alertes.length > 1 ? 's' : ''} à surveiller`}
          >
            {alertes.map((a) => a.organisme).join(', ')}
          </Encart>
        </div>
      )}

      {isPending ? (
        <Chargement />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data?.organismes.map((etat) => (
              <CarteOrganisme key={etat.organisme} etat={etat} />
            ))}
          </div>

          <Carte className="mt-6 overflow-hidden">
            <EnteteCarte
              icone={<History className="size-4" aria-hidden />}
              titre="Derniers passages"
              description="40 exécutions les plus récentes, tous organismes confondus."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-doux">
                    <th className="px-4 py-2.5">Quand</th>
                    <th className="px-4 py-2.5">Organisme</th>
                    <th className="px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5 text-right">Sessions</th>
                    <th className="px-4 py-2.5 text-right">Durée</th>
                    <th className="px-4 py-2.5">Déclencheur</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.historique.map((p) => (
                    <tr key={p.id} className="border-t border-bordure/70">
                      <td className="whitespace-nowrap px-4 py-2 text-doux">
                        {dateHeure(p.demarre_le)}
                      </td>
                      <td className="px-4 py-2">{p.organisme}</td>
                      <td className="px-4 py-2">
                        <Etiquette ton={p.statut === 'ok' ? 'succes' : 'erreur'}>
                          {p.statut}
                        </Etiquette>
                      </td>
                      <td className="chiffres px-4 py-2 text-right text-doux">
                        {p.nb_sessions !== null ? nombre(p.nb_sessions) : '—'}
                      </td>
                      <td className="chiffres px-4 py-2 text-right text-doux">
                        {secondes(p.duree_s)}
                      </td>
                      <td className="px-4 py-2 text-doux">{p.declencheur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-faible">
            <Database className="size-3.5" aria-hidden />
            Une session retirée d’un site source n’est jamais supprimée : son
            « dernier vu » cesse simplement d’avancer.
          </p>
        </>
      )}
    </>
  )
}
