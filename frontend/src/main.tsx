import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import { App } from './App'
import { FournisseurNotifications } from './contexte/Notifications'
import { FournisseurSession } from './contexte/Session'
import { FournisseurTheme } from './contexte/Theme'

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // Les données viennent d'un scrape quotidien : inutile de recharger à
      // chaque retour d'onglet. Le cache court garde la navigation instantanée.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <FournisseurTheme>
        <FournisseurNotifications>
          <FournisseurSession>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </FournisseurSession>
        </FournisseurNotifications>
      </FournisseurTheme>
    </QueryClientProvider>
  </StrictMode>,
)
