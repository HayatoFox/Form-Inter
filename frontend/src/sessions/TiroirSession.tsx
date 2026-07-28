import { useQuery } from '@tanstack/react-query'
import {
  Building2, CalendarDays, CircleDollarSign, Clock, ExternalLink, Infinity as Infini,
  Layers, MapPin, MessageSquareText, NotebookPen, PencilLine, TriangleAlert,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { dateLisible, depuis, duree, joursAvant, periode } from '@/lib/format'
import type { Session, SessionDetail } from '@/lib/types'
import { Tiroir } from '@/composants/ui/Tiroir'
import { Bouton, BoutonTelechargement } from '@/composants/ui/Bouton'
import { Etiquette, EtiquetteDomaine } from '@/composants/ui/Etiquette'
import { Chargement } from '@/composants/ui/Divers'

function Ligne({
  icone,
  libelle,
  children,
}: {
  icone: ReactNode
  libelle: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-3 text-faible">
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-faible">
          {libelle}
        </p>
        <div className="mt-0.5 text-sm text-texte">{children}</div>
      </div>
    </div>
  )
}

function Bloc({
  ton,
  icone,
  titre,
  children,
}: {
  ton: 'neutre' | 'accent' | 'alerte'
  icone: ReactNode
  titre: string
  children: ReactNode
}) {
  const tons = {
    neutre: 'border-bordure bg-surface-2 text-doux',
    accent: 'border-accent-200 bg-accent-50 text-accent-800 sombre:border-accent-700/40 sombre:bg-accent-900/20 sombre:text-accent-200',
    alerte: 'border-alerte/25 bg-alerte-doux text-alerte',
  }
  return (
    <div className={cn('rounded-lg border px-3.5 py-3', tons[ton])}>
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide">
        {icone}
        {titre}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

export function TiroirSession({
  session,
  onFermer,
  onCorriger,
  peutCorriger,
}: {
  session: Session | null
  onFermer: () => void
  onCorriger: (session: Session) => void
  peutCorriger: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['session', session?.id],
    queryFn: () => api.get<SessionDetail>(`/api/sessions/${session!.id}`),
    enabled: session !== null,
  })

  if (!session) return null
  const detail = data ?? (session as SessionDetail)
  const jours = joursAvant(session.date_debut)
  // Commencée mais pas terminée : « en cours », pas « passée ».
  const joursFin = joursAvant(session.date_fin)
  const enCours = jours !== null && jours < 0 && joursFin !== null && joursFin >= 0
  const complet = session.disponibilite?.toLowerCase().includes('complet')
  const dernieres = session.disponibilite?.toLowerCase().includes('dernières')
  const lien = detail.url_programme ?? detail.source_url

  return (
    <Tiroir
      ouvert
      onFermer={onFermer}
      titre={session.formation}
      soustitre={
        <span className="flex flex-wrap items-center gap-2">
          <EtiquetteDomaine domaine={session.domaine} />
          {session.type_formation && (
            <span className="text-faible">{session.type_formation}</span>
          )}
        </span>
      }
      pied={
        <>
          {peutCorriger && (
            <Bouton variante="secondaire" onClick={() => onCorriger(session)}>
              <PencilLine className="size-4" aria-hidden />
              Corriger
            </Bouton>
          )}
          {lien && (
            <BoutonTelechargement
              href={lien}
              target="_blank"
              rel="noopener noreferrer"
              variante="primaire"
            >
              <ExternalLink className="size-4" aria-hidden />
              Voir la fiche sur le site
            </BoutonTelechargement>
          )}
        </>
      }
    >
      {isLoading && !data ? (
        <Chargement />
      ) : (
        <div className="space-y-5">
          {/* Alertes en premier : ce sont elles qui changent une décision. */}
          {(complet || dernieres) && (
            <Bloc
              ton="alerte"
              icone={<TriangleAlert className="size-3.5" aria-hidden />}
              titre="Disponibilité"
            >
              {session.disponibilite}
            </Bloc>
          )}

          <div className="divide-y divide-bordure/70">
            <Ligne
              icone={session.permanente ? <Infini className="size-3.5" /> : <CalendarDays className="size-3.5" />}
              libelle="Dates"
            >
              {session.permanente ? (
                <span>Entrée / sortie permanente</span>
              ) : (
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{periode(session.date_debut, session.date_fin)}</span>
                  {jours !== null && (
                    <Etiquette ton={jours < 0 ? (enCours ? 'succes' : 'neutre') : jours <= 7 ? 'accent' : 'primaire'}>
                      {jours < 0
                        ? enCours
                          ? 'en cours'
                          : 'session passée'
                        : jours === 0
                          ? "aujourd'hui"
                          : `dans ${jours} jour${jours > 1 ? 's' : ''}`}
                    </Etiquette>
                  )}
                </span>
              )}
            </Ligne>

            {session.duree_jours !== null && (
              <Ligne icone={<Clock className="size-3.5" />} libelle="Durée">
                {duree(session.duree_jours)}
              </Ligne>
            )}

            <Ligne icone={<Building2 className="size-3.5" />} libelle="Organisme">
              {session.organisme}
            </Ligne>

            <Ligne icone={<MapPin className="size-3.5" />} libelle="Lieu">
              {session.ville || <span className="text-faible">non précisé</span>}
            </Ligne>

            <Ligne icone={<CircleDollarSign className="size-3.5" />} libelle="Tarif">
              {session.tarif ? (
                <span>
                  {session.tarif}
                  {session.organisme === 'Groupe ACN' && (
                    <span className="mt-0.5 block text-xs text-faible">
                      Tarif de groupe, pas par personne.
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-faible">non publié sur le site source</span>
              )}
            </Ligne>

            <Ligne icone={<Layers className="size-3.5" />} libelle="Collecte">
              <span className="text-doux">
                Vue pour la première fois le {dateLisible(session.first_seen)}, encore
                affichée au scrape du {dateLisible(session.last_seen)} ({depuis(session.last_seen)}).
              </span>
            </Ligne>
          </div>

          {session.remarque && (
            <Bloc
              ton="neutre"
              icone={<MessageSquareText className="size-3.5" aria-hidden />}
              titre="Remarque du site source"
            >
              {session.remarque}
            </Bloc>
          )}

          {session.note_interne && (
            <Bloc
              ton="accent"
              icone={<NotebookPen className="size-3.5" aria-hidden />}
              titre="Note interne PROINSEC"
            >
              {session.note_interne}
            </Bloc>
          )}

          {session.a_override && session.formation !== session.formation_origine && (
            <p className="text-xs text-faible">
              Intitulé corrigé par l’équipe. Libellé d’origine du site :{' '}
              <span className="text-doux">« {session.formation_origine} »</span>
            </p>
          )}

          {detail.autres_dates?.length > 0 && (
            <div>
              <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-faible">
                Autres sessions de cette formation ({detail.autres_dates.length})
              </h3>
              <ul className="overflow-hidden rounded-lg border border-bordure">
                {detail.autres_dates.map((autre) => (
                  <li
                    key={autre.id}
                    className="flex items-center justify-between gap-3 border-b border-bordure/70 px-3 py-2 text-sm last:border-b-0 odd:bg-surface-2/50"
                  >
                    <span className="min-w-0 truncate text-doux">{autre.ville}</span>
                    <span className="shrink-0 whitespace-nowrap">
                      {autre.date_debut ? (
                        periode(autre.date_debut, autre.date_fin)
                      ) : (
                        <span className="text-primaire">permanente</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Tiroir>
  )
}
