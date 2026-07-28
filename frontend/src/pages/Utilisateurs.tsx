import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, ShieldCheck, ShieldOff, UserPlus, UserRoundCheck, UserRoundX } from 'lucide-react'
import { api, messageErreur } from '@/lib/api'
import { dateHeure, depuis } from '@/lib/format'
import type { Utilisateur } from '@/lib/types'
import { useNotifications } from '@/contexte/Notifications'
import { useSession } from '@/contexte/Session'
import { EntetePage } from '@/composants/Layout'
import { Bouton } from '@/composants/ui/Bouton'
import { Carte } from '@/composants/ui/Carte'
import { Case, Champ, Groupe } from '@/composants/ui/Champ'
import { Etiquette } from '@/composants/ui/Etiquette'
import { Chargement, Encart } from '@/composants/ui/Divers'
import { Modale } from '@/composants/ui/Modale'

/** Le mot de passe généré n'est lisible qu'une fois : on le présente en
 *  grand, copiable, avec un rappel explicite. */
function ModaleMotDePasseGenere({
  mdp,
  identifiant,
  onFermer,
}: {
  mdp: string
  identifiant: string
  onFermer: () => void
}) {
  const [copie, setCopie] = useState(false)
  return (
    <Modale
      ouverte
      onFermer={onFermer}
      titre="Mot de passe généré"
      description={`À transmettre à « ${identifiant} » — il ne sera plus affiché.`}
      largeur="max-w-md"
      pied={
        <Bouton variante="primaire" onClick={onFermer}>
          J’ai noté le mot de passe
        </Bouton>
      }
    >
      <div className="flex items-center gap-2 rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
        <code className="flex-1 select-all font-mono text-base tracking-tight">{mdp}</code>
        <Bouton
          variante="secondaire"
          taille="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(mdp)
            setCopie(true)
            setTimeout(() => setCopie(false), 2000)
          }}
        >
          {copie ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copie ? 'Copié' : 'Copier'}
        </Bouton>
      </div>
      <p className="mt-3 text-xs text-doux">
        Invitez la personne à le changer depuis son menu, en bas de la barre de
        navigation.
      </p>
    </Modale>
  )
}

export function Utilisateurs() {
  const { notifier } = useNotifications()
  const { utilisateur: moi } = useSession()
  const cache = useQueryClient()
  const [nouveau, setNouveau] = useState('')
  const [admin, setAdmin] = useState(false)
  const [genere, setGenere] = useState<{ mdp: string; identifiant: string } | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['utilisateurs'],
    queryFn: () => api.get<Utilisateur[]>('/api/admin/utilisateurs'),
  })

  const rafraichir = () => cache.invalidateQueries({ queryKey: ['utilisateurs'] })

  const creer = useMutation({
    mutationFn: () =>
      api.post<{ mdp: string }>('/api/admin/utilisateurs', { identifiant: nouveau, admin }),
    onSuccess: (reponse) => {
      setGenere({ mdp: reponse.mdp, identifiant: nouveau })
      setNouveau('')
      setAdmin(false)
      rafraichir()
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  const agir = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.post<{ mdp?: string }>(`/api/admin/utilisateurs/${id}`, { action }),
    onSuccess: (reponse, variables) => {
      if (reponse.mdp) {
        const cible = data?.find((u) => u.id === variables.id)
        setGenere({ mdp: reponse.mdp, identifiant: cible?.identifiant ?? '' })
      } else {
        notifier('succes', 'Compte mis à jour.')
      }
      rafraichir()
    },
    onError: (erreur) => notifier('erreur', messageErreur(erreur)),
  })

  return (
    <>
      <EntetePage
        titre="Utilisateurs"
        description="Comptes d’accès à l’outil. Les mots de passe sont générés et affichés une seule fois."
      />

      {isPending ? (
        <Chargement />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Carte className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-doux">
                    <th className="px-4 py-2.5">Identifiant</th>
                    <th className="px-4 py-2.5">Rôle</th>
                    <th className="px-4 py-2.5">Dernier accès</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((u) => (
                    <tr key={u.id} className="border-t border-bordure/70">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span
                            className={
                              'flex size-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold ' +
                              (u.actif ? 'bg-primaire text-white' : 'bg-surface-3 text-faible')
                            }
                          >
                            {u.identifiant.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{u.identifiant}</span>
                            {!u.actif && (
                              <span className="text-[0.6875rem] text-erreur">désactivé</span>
                            )}
                            {u.id === moi?.id && (
                              <span className="text-[0.6875rem] text-faible">vous</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Etiquette ton={u.admin ? 'primaire' : 'neutre'}>
                          {u.admin ? 'administrateur' : 'utilisateur'}
                        </Etiquette>
                      </td>
                      <td className="px-4 py-3 text-xs text-doux">
                        {u.dernier_acces ? (
                          <span title={dateHeure(u.dernier_acces)}>{depuis(u.dernier_acces)}</span>
                        ) : (
                          <span className="text-faible">jamais connecté</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Bouton
                            variante="discret"
                            taille="sm"
                            title={u.admin ? 'Retirer le rôle admin' : 'Donner le rôle admin'}
                            onClick={() =>
                              agir.mutate({
                                id: u.id,
                                action: u.admin ? 'retrograder' : 'promouvoir',
                              })
                            }
                          >
                            {u.admin ? (
                              <ShieldOff className="size-3.5" aria-hidden />
                            ) : (
                              <ShieldCheck className="size-3.5" aria-hidden />
                            )}
                            {u.admin ? 'Retirer admin' : 'Rendre admin'}
                          </Bouton>
                          <Bouton
                            variante="discret"
                            taille="sm"
                            title="Générer un nouveau mot de passe"
                            onClick={() => agir.mutate({ id: u.id, action: 'reinit_mdp' })}
                          >
                            <KeyRound className="size-3.5" aria-hidden />
                            Mot de passe
                          </Bouton>
                          <Bouton
                            variante="discret"
                            taille="sm"
                            className={u.actif ? 'hover:bg-erreur-doux hover:text-erreur' : ''}
                            onClick={() =>
                              agir.mutate({
                                id: u.id,
                                action: u.actif ? 'desactiver' : 'reactiver',
                              })
                            }
                          >
                            {u.actif ? (
                              <UserRoundX className="size-3.5" aria-hidden />
                            ) : (
                              <UserRoundCheck className="size-3.5" aria-hidden />
                            )}
                            {u.actif ? 'Désactiver' : 'Réactiver'}
                          </Bouton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          <div className="space-y-4">
            <Carte>
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault()
                  creer.mutate()
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primaire-doux text-primaire">
                    <UserPlus className="size-4" aria-hidden />
                  </span>
                  <h2 className="text-[0.9375rem] font-semibold">Créer un compte</h2>
                </div>
                <Groupe libelle="Identifiant">
                  {(id) => (
                    <Champ
                      id={id}
                      value={nouveau}
                      maxLength={60}
                      required
                      placeholder="prenom.nom"
                      onChange={(e) => setNouveau(e.target.value)}
                    />
                  )}
                </Groupe>
                <Case
                  coche={admin}
                  onChange={setAdmin}
                  libelle="Administrateur"
                  aide="Accès au back office : santé, statistiques, corrections, comptes"
                />
                <Bouton
                  type="submit"
                  variante="primaire"
                  className="w-full"
                  disabled={!nouveau.trim()}
                  chargement={creer.isPending}
                >
                  Créer le compte
                </Bouton>
                <p className="text-xs text-faible">
                  Le mot de passe initial est généré automatiquement et affiché
                  une seule fois après la création.
                </p>
              </form>
            </Carte>

            <Encart ton="info" titre="Authentification">
              Les mots de passe sont stockés hachés (scrypt). Le passage au SSO
              PROINSEC est prévu et n’impactera que le module d’authentification.
            </Encart>
          </div>
        </div>
      )}

      {genere && (
        <ModaleMotDePasseGenere
          mdp={genere.mdp}
          identifiant={genere.identifiant}
          onFermer={() => setGenere(null)}
        />
      )}
    </>
  )
}
