import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, definirCsrf } from '@/lib/api'
import type { Utilisateur } from '@/lib/types'

type EtatSession = { utilisateur: Utilisateur | null; csrf: string | null }

const Contexte = createContext<{
  utilisateur: Utilisateur | null
  pret: boolean
  connecter: (identifiant: string, mdp: string) => Promise<void>
  deconnecter: () => Promise<void>
} | null>(null)

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [pret, setPret] = useState(false)

  const appliquer = useCallback((etat: EtatSession) => {
    definirCsrf(etat.csrf)
    setUtilisateur(etat.utilisateur)
  }, [])

  useEffect(() => {
    api
      .get<EtatSession>('/api/moi')
      .then(appliquer)
      .catch(() => appliquer({ utilisateur: null, csrf: null }))
      .finally(() => setPret(true))
  }, [appliquer])

  const connecter = useCallback(
    async (identifiant: string, mdp: string) => {
      appliquer(await api.post<EtatSession>('/api/connexion', { identifiant, mdp }))
    },
    [appliquer],
  )

  const deconnecter = useCallback(async () => {
    try {
      await api.post('/api/deconnexion')
    } finally {
      appliquer({ utilisateur: null, csrf: null })
    }
  }, [appliquer])

  return (
    <Contexte.Provider value={{ utilisateur, pret, connecter, deconnecter }}>
      {children}
    </Contexte.Provider>
  )
}

export function useSession() {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useSession hors FournisseurSession')
  return contexte
}
