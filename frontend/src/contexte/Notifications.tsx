import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Ton = 'succes' | 'erreur' | 'info' | 'alerte'
type Notification = { id: number; ton: Ton; texte: string; detail?: string }

const Contexte = createContext<{
  notifier: (ton: Ton, texte: string, detail?: string) => void
} | null>(null)

let compteur = 0

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notification[]>([])

  const notifier = useCallback((ton: Ton, texte: string, detail?: string) => {
    const id = ++compteur
    setListe((l) => [...l, { id, ton, texte, detail }])
  }, [])

  const retirer = useCallback((id: number) => {
    setListe((l) => l.filter((n) => n.id !== id))
  }, [])

  return (
    <Contexte.Provider value={{ notifier }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        {liste.map((n) => (
          <Bandeau key={n.id} notification={n} onFermer={() => retirer(n.id)} />
        ))}
      </div>
    </Contexte.Provider>
  )
}

const ICONES: Record<Ton, typeof Info> = {
  succes: CheckCircle2,
  erreur: XCircle,
  alerte: AlertTriangle,
  info: Info,
}
const TONS: Record<Ton, string> = {
  succes: 'text-succes',
  erreur: 'text-erreur',
  alerte: 'text-alerte',
  info: 'text-primaire',
}

function Bandeau({
  notification,
  onFermer,
}: {
  notification: Notification
  onFermer: () => void
}) {
  // Les erreurs restent plus longtemps : on veut avoir le temps de les lire.
  const duree = notification.ton === 'erreur' ? 7000 : 4000
  useEffect(() => {
    const minuteur = setTimeout(onFermer, duree)
    return () => clearTimeout(minuteur)
  }, [duree, onFermer])

  const Icone = ICONES[notification.ton]
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-sm animate-montee items-start gap-3 rounded-xl border border-bordure bg-surface px-4 py-3 ombre-flottante"
    >
      <Icone className={cn('mt-0.5 size-4 shrink-0', TONS[notification.ton])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-texte">{notification.texte}</p>
        {notification.detail && (
          <p className="mt-0.5 text-xs text-doux">{notification.detail}</p>
        )}
      </div>
      <button
        onClick={onFermer}
        className="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-faible transition-colors hover:text-texte"
        aria-label="Fermer la notification"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function useNotifications() {
  const contexte = useContext(Contexte)
  if (!contexte) throw new Error('useNotifications hors FournisseurNotifications')
  return contexte
}
