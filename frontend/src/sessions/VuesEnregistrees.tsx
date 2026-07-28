import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, Star, Trash2, Users } from 'lucide-react'
import { api, messageErreur } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Filtres, Vue } from '@/lib/types'
import { depuisQuery, versQuery } from '@/lib/filtres'
import { useNotifications } from '@/contexte/Notifications'
import { Bouton } from '@/composants/ui/Bouton'
import { Modale } from '@/composants/ui/Modale'
import { Champ, Groupe, Interrupteur } from '@/composants/ui/Champ'

/** Barre des vues enregistrées : combinaisons de filtres rappelables en un
 *  clic, personnelles ou partagées avec l'équipe. */
export function VuesEnregistrees({
  filtres,
  onFiltres,
}: {
  filtres: Filtres
  onFiltres: (f: Filtres) => void
}) {
  const { notifier } = useNotifications()
  const cache = useQueryClient()
  const [ouverte, setOuverte] = useState(false)
  const [nom, setNom] = useState('')
  const [partagee, setPartagee] = useState(false)

  const { data: vues = [] } = useQuery({
    queryKey: ['vues'],
    queryFn: () => api.get<Vue[]>('/api/vues'),
  })

  const enregistrer = useMutation({
    mutationFn: () =>
      api.post<Vue>('/api/vues', { nom, query: versQuery(filtres), partagee }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['vues'] })
      notifier('succes', `Vue « ${nom} » enregistrée.`)
      setOuverte(false)
      setNom('')
      setPartagee(false)
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  const supprimer = useMutation({
    mutationFn: (id: number) => api.supprimer(`/api/vues/${id}`),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['vues'] })
      notifier('succes', 'Vue supprimée.')
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  // La vue appliquée est celle dont les critères correspondent à l'URL
  // courante (la pagination et le tri ne comptent pas dans la comparaison).
  const queryCourante = versQuery({ ...filtres, page: 1 })
  const estActive = (vue: Vue) =>
    versQuery({ ...depuisQuery(vue.query), page: 1 }) === queryCourante

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {vues.map((vue) => {
          const active = estActive(vue)
          return (
            <span
              key={vue.id}
              className={cn(
                'group inline-flex items-center rounded-lg border transition-colors',
                active
                  ? 'border-primaire/45 bg-primaire-doux text-primaire'
                  : 'border-bordure bg-surface text-doux hover:border-bordure-forte hover:text-texte',
              )}
            >
              <button
                onClick={() => onFiltres({ ...depuisQuery(vue.query), page: 1 })}
                className="flex max-w-56 items-center gap-1.5 py-1 pl-2.5 pr-2 text-xs font-medium"
                title={
                  vue.partagee && !vue.a_moi
                    ? `Vue partagée par ${vue.proprietaire}`
                    : undefined
                }
              >
                {vue.partagee ? (
                  <Users className="size-3 shrink-0 opacity-60" aria-hidden />
                ) : (
                  <Star
                    className={cn('size-3 shrink-0', active ? 'fill-current' : 'opacity-60')}
                    aria-hidden
                  />
                )}
                <span className="truncate">{vue.nom}</span>
              </button>
              {vue.a_moi && (
                <button
                  onClick={() => supprimer.mutate(vue.id)}
                  aria-label={`Supprimer la vue ${vue.nom}`}
                  className="mr-1 rounded p-1 opacity-0 transition-opacity hover:text-erreur focus-visible:opacity-100 group-hover:opacity-60"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </span>
          )
        })}

        <Bouton
          variante="discret"
          taille="sm"
          onClick={() => setOuverte(true)}
          className="text-xs"
        >
          <BookmarkPlus className="size-3.5" aria-hidden />
          Enregistrer cette vue
        </Bouton>
      </div>

      <Modale
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        titre="Enregistrer cette vue"
        description="Les filtres actuels seront rappelés en un clic depuis la barre des vues."
        largeur="max-w-md"
        pied={
          <>
            <Bouton variante="secondaire" onClick={() => setOuverte(false)}>
              Annuler
            </Bouton>
            <Bouton
              variante="primaire"
              disabled={!nom.trim()}
              chargement={enregistrer.isPending}
              onClick={() => enregistrer.mutate()}
            >
              Enregistrer
            </Bouton>
          </>
        }
      >
        <div className="space-y-4">
          <Groupe libelle="Nom de la vue">
            {(id) => (
              <Champ
                id={id}
                value={nom}
                maxLength={60}
                autoFocus
                placeholder="CACES Grand Ouest, Habilitations à 30 jours…"
                onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nom.trim()) enregistrer.mutate()
                }}
              />
            )}
          </Groupe>
          <Interrupteur
            actif={partagee}
            onChange={setPartagee}
            libelle="Partager avec l’équipe"
            aide="Tous les utilisateurs connectés verront cette vue."
          />
        </div>
      </Modale>
    </>
  )
}
