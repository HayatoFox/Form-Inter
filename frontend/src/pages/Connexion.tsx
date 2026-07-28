import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, Database, Filter, Loader2, ShieldCheck } from 'lucide-react'
import { messageErreur } from '@/lib/api'
import { useSession } from '@/contexte/Session'
import { Logo } from '@/composants/Marque'
import { Bouton } from '@/composants/ui/Bouton'
import { Champ, Groupe } from '@/composants/ui/Champ'

const ARGUMENTS = [
  {
    icone: Database,
    titre: 'Cinq organismes, une seule base',
    texte: 'PILOCAP, TEMIS, CEPIM, Groupe ACN et VoltWork, collectés chaque nuit.',
  },
  {
    icone: Filter,
    titre: 'Le bon créneau en trois clics',
    texte: 'Domaine, ville, période, durée — et l’export Excel du résultat exact.',
  },
  {
    icone: ShieldCheck,
    titre: 'Corrections qui tiennent',
    texte: 'Les rectifications de l’équipe survivent aux collectes suivantes.',
  },
]

export function Connexion() {
  const { utilisateur, pret, connecter } = useSession()
  const [identifiant, setIdentifiant] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  if (!pret) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-fond">
        <Loader2 className="size-5 animate-spin text-faible" aria-label="Chargement" />
      </div>
    )
  }
  if (utilisateur) return <Navigate to="/" replace />

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur('')
    setEnCours(true)
    try {
      await connecter(identifiant, mdp)
    } catch (e) {
      setErreur(messageErreur(e))
      setEnCours(false)
    }
  }

  return (
    <div className="grid min-h-dvh bg-fond lg:grid-cols-[1fr_1.1fr]">
      {/* Formulaire */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo className="size-11" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-1.5 text-sm text-doux">
            Outil interne PROINSEC — veille des formations inter-entreprises.
          </p>

          <form onSubmit={envoyer} className="mt-8 space-y-4">
            <Groupe libelle="Identifiant">
              {(id) => (
                <Champ
                  id={id}
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  className="h-10"
                />
              )}
            </Groupe>
            <Groupe libelle="Mot de passe">
              {(id) => (
                <Champ
                  id={id}
                  type="password"
                  value={mdp}
                  onChange={(e) => setMdp(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-10"
                />
              )}
            </Groupe>

            {erreur && (
              <p
                role="alert"
                className="rounded-lg border border-erreur/25 bg-erreur-doux px-3 py-2 text-sm text-erreur"
              >
                {erreur}
              </p>
            )}

            <Bouton
              type="submit"
              variante="primaire"
              taille="lg"
              chargement={enCours}
              className="w-full"
            >
              Se connecter
            </Bouton>
          </form>

          <p className="mt-8 text-xs text-faible">
            Accès réservé aux collaborateurs. En cas d’oubli de mot de passe,
            contactez un administrateur de l’outil.
          </p>
        </div>
      </div>

      {/* Panneau de présentation (masqué sur petit écran) */}
      <div className="relative hidden overflow-hidden bg-marque-900 lg:block">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(110% 80% at 78% 8%, #0086d1 0%, #005c8f 42%, #062842 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2 text-sm font-medium text-white/70">
            <Building2 className="size-4" aria-hidden />
            PROINSEC · Prévention & sécurité
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              Toute l’offre de formation des organismes suivis,
              <span className="text-accent-300"> à jour chaque matin.</span>
            </h2>
            <div className="mt-9 space-y-6">
              {ARGUMENTS.map((a) => {
                const Icone = a.icone
                return (
                  <div key={a.titre} className="flex gap-3.5">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                      <Icone className="size-4.5 text-white" aria-hidden />
                    </span>
                    <div>
                      <p className="font-medium text-white">{a.titre}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-white/65">{a.texte}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-xs text-white/45">
            Données collectées automatiquement sur les sites des organismes — à
            recouper avant tout engagement.
          </p>
        </div>
      </div>
    </div>
  )
}
