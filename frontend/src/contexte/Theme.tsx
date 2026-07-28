import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'clair' | 'sombre' | 'systeme'
const CLE = 'proinsec-theme'

const Contexte = createContext<{
  theme: Theme
  definir: (theme: Theme) => void
} | null>(null)

function appliquer(theme: Theme) {
  const sombre =
    theme === 'sombre' ||
    (theme === 'systeme' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('sombre', sombre)
}

export function FournisseurTheme({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(CLE) as Theme | null) ?? 'systeme',
  )

  useEffect(() => {
    appliquer(theme)
    if (theme !== 'systeme') return
    // En mode « système », suivre les bascules jour/nuit de l'OS en direct.
    const media = matchMedia('(prefers-color-scheme: dark)')
    const auChangement = () => appliquer('systeme')
    media.addEventListener('change', auChangement)
    return () => media.removeEventListener('change', auChangement)
  }, [theme])

  const definir = useCallback((suivant: Theme) => {
    setTheme(suivant)
    if (suivant === 'systeme') localStorage.removeItem(CLE)
    else localStorage.setItem(CLE, suivant)
  }, [])

  return <Contexte.Provider value={{ theme, definir }}>{children}</Contexte.Provider>
}

export function useTheme() {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useTheme hors FournisseurTheme')
  return contexte
}
