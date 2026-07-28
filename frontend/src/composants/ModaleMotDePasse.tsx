import { useState } from 'react'
import { api, messageErreur } from '@/lib/api'
import { useNotifications } from '@/contexte/Notifications'
import { Modale } from './ui/Modale'
import { Bouton } from './ui/Bouton'
import { Champ, Groupe } from './ui/Champ'

export function ModaleMotDePasse({
  ouverte,
  onFermer,
}: {
  ouverte: boolean
  onFermer: () => void
}) {
  const { notifier } = useNotifications()
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [enCours, setEnCours] = useState(false)

  const fermer = () => {
    setActuel('')
    setNouveau('')
    setConfirmation('')
    onFermer()
  }

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nouveau !== confirmation) {
      notifier('erreur', 'Les deux mots de passe ne correspondent pas.')
      return
    }
    setEnCours(true)
    try {
      await api.post('/api/mot-de-passe', { actuel, nouveau })
      notifier('succes', 'Mot de passe modifié.')
      fermer()
    } catch (erreur) {
      notifier('erreur', messageErreur(erreur))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      ouverte={ouverte}
      onFermer={fermer}
      titre="Changer mon mot de passe"
      description="Au moins 10 caractères."
      largeur="max-w-md"
    >
      <form onSubmit={envoyer} className="space-y-4">
        <Groupe libelle="Mot de passe actuel">
          {(id) => (
            <Champ
              id={id}
              type="password"
              value={actuel}
              autoComplete="current-password"
              onChange={(e) => setActuel(e.target.value)}
              required
            />
          )}
        </Groupe>
        <Groupe libelle="Nouveau mot de passe">
          {(id) => (
            <Champ
              id={id}
              type="password"
              value={nouveau}
              autoComplete="new-password"
              minLength={10}
              onChange={(e) => setNouveau(e.target.value)}
              required
            />
          )}
        </Groupe>
        <Groupe libelle="Confirmer le nouveau mot de passe">
          {(id) => (
            <Champ
              id={id}
              type="password"
              value={confirmation}
              autoComplete="new-password"
              minLength={10}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          )}
        </Groupe>
        <div className="flex justify-end gap-2 pt-1">
          <Bouton type="button" variante="secondaire" onClick={fermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" variante="primaire" chargement={enCours}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Modale>
  )
}
