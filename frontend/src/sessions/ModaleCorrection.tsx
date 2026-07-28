import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff } from 'lucide-react'
import { api, messageErreur } from '@/lib/api'
import type { Session } from '@/lib/types'
import { periode } from '@/lib/format'
import { useNotifications } from '@/contexte/Notifications'
import { Modale } from '@/composants/ui/Modale'
import { Bouton } from '@/composants/ui/Bouton'
import { Case, Champ, Groupe, Liste } from '@/composants/ui/Champ'
import { EtiquetteDomaine } from '@/composants/ui/Etiquette'

/** Correction durable d'une session (table `overrides`) : masquer, renommer,
 *  reclasser, annoter. La session elle-même n'est jamais modifiée — les
 *  corrections sont réappliquées en lecture après chaque scrape. */
export function ModaleCorrection({
  session,
  onFermer,
}: {
  session: Session | null
  onFermer: () => void
}) {
  const { notifier } = useNotifications()
  const cache = useQueryClient()
  const [masquee, setMasquee] = useState(false)
  const [formation, setFormation] = useState('')
  const [domaine, setDomaine] = useState('')
  const [note, setNote] = useState('')

  const { data: domaines = [] } = useQuery({
    queryKey: ['domaines'],
    queryFn: () => api.get<string[]>('/api/admin/domaines'),
    enabled: session !== null,
    staleTime: Infinity,
  })

  // Pré-remplissage depuis la correction déjà en place, s'il y en a une :
  // la vue `sessions_effectives` renvoie déjà les valeurs corrigées.
  useEffect(() => {
    if (!session) return
    setMasquee(false)
    setFormation(session.formation !== session.formation_origine ? session.formation : '')
    setDomaine('')
    setNote(session.note_interne ?? '')
  }, [session])

  const enregistrer = useMutation({
    mutationFn: () =>
      api.post('/api/admin/overrides', {
        organisme: session!.organisme,
        formation: session!.formation_origine,
        ville: session!.ville ?? '',
        date_debut: session!.date_debut ?? '',
        date_fin: session!.date_fin ?? '',
        masquee,
        formation_override: formation,
        domaine_override: domaine,
        note_interne: note,
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['sessions'] })
      cache.invalidateQueries({ queryKey: ['overrides'] })
      cache.invalidateQueries({ queryKey: ['session'] })
      notifier('succes', 'Correction enregistrée.', 'Elle survivra aux prochains scrapes.')
      onFermer()
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  if (!session) return null

  return (
    <Modale
      ouverte
      onFermer={onFermer}
      titre="Corriger cette session"
      description="Ces corrections sont conservées d’un scrape à l’autre."
      pied={
        <>
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            variante="primaire"
            chargement={enregistrer.isPending}
            onClick={() => enregistrer.mutate()}
          >
            Enregistrer
          </Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-bordure bg-surface-2 px-3.5 py-3">
          <p className="font-medium">{session.formation_origine}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-doux">
            <span>{session.organisme}</span>
            <span className="text-faible">·</span>
            <span>{session.ville}</span>
            <span className="text-faible">·</span>
            <span>
              {session.permanente ? 'permanente' : periode(session.date_debut, session.date_fin)}
            </span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-faible">
            domaine calculé : <EtiquetteDomaine domaine={session.domaine} />
          </p>
        </div>

        <Case
          coche={masquee}
          onChange={setMasquee}
          libelle={
            <span className="flex items-center gap-1.5">
              <EyeOff className="size-3.5 text-faible" aria-hidden />
              Masquer cette session (erronée / hors sujet)
            </span>
          }
          className="border border-bordure"
        />

        <Groupe
          libelle="Intitulé corrigé"
          aide={`Vide = garder « ${session.formation_origine} »`}
        >
          {(id) => (
            <Champ
              id={id}
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              placeholder={session.formation_origine}
            />
          )}
        </Groupe>

        <Groupe libelle="Domaine corrigé">
          {(id) => (
            <Liste id={id} value={domaine} onChange={(e) => setDomaine(e.target.value)}>
              <option value="">— garder le domaine calculé —</option>
              {domaines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Liste>
          )}
        </Groupe>

        <Groupe libelle="Note interne" aide="Visible par toute l’équipe dans la fiche.">
          {(id) => (
            <Champ
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vérifié auprès de l’organisme le…"
            />
          )}
        </Groupe>
      </div>
    </Modale>
  )
}
