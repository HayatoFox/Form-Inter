import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff, Link2Off, NotebookPen, PencilRuler, Tag, Trash2, Type } from 'lucide-react'
import { api, messageErreur } from '@/lib/api'
import { dateCourte, periode } from '@/lib/format'
import type { Override } from '@/lib/types'
import { useNotifications } from '@/contexte/Notifications'
import { EntetePage } from '@/composants/Layout'
import { Bouton } from '@/composants/ui/Bouton'
import { Carte } from '@/composants/ui/Carte'
import { Etiquette } from '@/composants/ui/Etiquette'
import { Chargement, EtatVide } from '@/composants/ui/Divers'

function DetailCorrections({ o }: { o: Override }) {
  const items = []
  if (o.masquee)
    items.push(
      <Etiquette key="m" ton="erreur">
        <EyeOff className="size-3" aria-hidden />
        masquée
      </Etiquette>,
    )
  if (o.formation_override)
    items.push(
      <Etiquette key="f" ton="primaire" titre={o.formation_override}>
        <Type className="size-3" aria-hidden />
        {o.formation_override}
      </Etiquette>,
    )
  if (o.domaine_override)
    items.push(
      <Etiquette key="d" ton="accent">
        <Tag className="size-3" aria-hidden />
        {o.domaine_override}
      </Etiquette>,
    )
  if (o.note_interne)
    items.push(
      <Etiquette key="n" ton="neutre" titre={o.note_interne}>
        <NotebookPen className="size-3" aria-hidden />
        {o.note_interne}
      </Etiquette>,
    )
  return <div className="flex flex-wrap gap-1.5">{items}</div>
}

export function Corrections() {
  const { notifier } = useNotifications()
  const cache = useQueryClient()

  const { data, isPending } = useQuery({
    queryKey: ['overrides'],
    queryFn: () => api.get<Override[]>('/api/admin/overrides'),
  })

  const retirer = useMutation({
    mutationFn: (id: number) => api.supprimer(`/api/admin/overrides/${id}`),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['overrides'] })
      cache.invalidateQueries({ queryKey: ['sessions'] })
      notifier('succes', 'Correction retirée.', 'Les valeurs collectées sont restaurées.')
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  const orphelines = data?.filter((o) => o.orpheline).length ?? 0

  return (
    <>
      <EntetePage
        titre="Corrections enregistrées"
        description="Rectifications de l’équipe, réappliquées après chaque collecte. Pour en créer une : ouvrez une session puis « Corriger »."
      />

      {isPending ? (
        <Chargement />
      ) : !data || data.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<PencilRuler className="size-5" aria-hidden />}
            titre="Aucune correction enregistrée"
            description="Depuis la liste des sessions, ouvrez une fiche et cliquez « Corriger » pour masquer, renommer, reclasser ou annoter une session."
          />
        </Carte>
      ) : (
        <>
          {orphelines > 0 && (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-alerte">
              <Link2Off className="size-3.5" aria-hidden />
              {orphelines} correction{orphelines > 1 ? 's' : ''} orpheline
              {orphelines > 1 ? 's' : ''} : la session visée n’existe plus sous cette
              clé (renommée ou retirée du site source).
            </p>
          )}

          <Carte className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-doux">
                    <th className="px-4 py-2.5">Session visée</th>
                    <th className="px-4 py-2.5">Corrections</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Modifiée le</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((o) => (
                    <tr key={o.id} className="border-t border-bordure/70 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.formation}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-doux">
                          <span>{o.organisme}</span>
                          {o.ville && (
                            <>
                              <span className="text-faible">·</span>
                              <span>{o.ville}</span>
                            </>
                          )}
                          {o.date_debut && (
                            <>
                              <span className="text-faible">·</span>
                              <span>{periode(o.date_debut, o.date_fin || o.date_debut)}</span>
                            </>
                          )}
                          {o.orpheline && (
                            <Etiquette ton="alerte" titre="La session n’existe plus sous cette clé">
                              <Link2Off className="size-3" aria-hidden />
                              orpheline
                            </Etiquette>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <DetailCorrections o={o} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-doux">
                        {dateCourte(o.maj_le.slice(0, 10))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Bouton
                          variante="discret"
                          taille="sm"
                          onClick={() => retirer.mutate(o.id)}
                          className="hover:bg-erreur-doux hover:text-erreur"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Retirer
                        </Bouton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>
        </>
      )}
    </>
  )
}
