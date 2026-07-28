import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useSession } from './contexte/Session'
import { Layout } from './composants/Layout'
import { EtatVide } from './composants/ui/Divers'
import { BoutonLien } from './composants/ui/Bouton'
import { Connexion } from './pages/Connexion'
import { Sessions } from './pages/Sessions'
import { Sante } from './pages/Sante'
import { Statistiques } from './pages/Statistiques'
import { Corrections } from './pages/Corrections'
import { Utilisateurs } from './pages/Utilisateurs'

function Attente() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-fond">
      <Loader2 className="size-5 animate-spin text-faible" aria-label="Chargement" />
    </div>
  )
}

/** Tout le site est derrière la connexion ; /admin/* exige en plus le rôle. */
function Protege({ admin, children }: { admin?: boolean; children: React.ReactNode }) {
  const { utilisateur, pret } = useSession()
  if (!pret) return <Attente />
  if (!utilisateur) return <Navigate to="/connexion" replace />
  if (admin && !utilisateur.admin) {
    return (
      <EtatVide
        titre="Accès réservé"
        description="Cette page est réservée aux administrateurs de l’outil."
        action={<BoutonLien to="/">Retour aux sessions</BoutonLien>}
      />
    )
  }
  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route
        element={
          <Protege>
            <Layout />
          </Protege>
        }
      >
        <Route path="/" element={<Sessions />} />
        <Route path="/admin" element={<Protege admin><Sante /></Protege>} />
        <Route
          path="/admin/statistiques"
          element={<Protege admin><Statistiques /></Protege>}
        />
        <Route
          path="/admin/corrections"
          element={<Protege admin><Corrections /></Protege>}
        />
        <Route
          path="/admin/utilisateurs"
          element={<Protege admin><Utilisateurs /></Protege>}
        />
        <Route
          path="*"
          element={
            <EtatVide
              titre="Page introuvable"
              description="Cette adresse ne correspond à aucune page de l’outil."
              action={<BoutonLien to="/">Retour aux sessions</BoutonLien>}
            />
          }
        />
      </Route>
    </Routes>
  )
}
