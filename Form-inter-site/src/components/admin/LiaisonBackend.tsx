"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import {
  enregistrerLiaison,
  lancerSynchronisation,
  purgerDonneesBackend,
  testerLiaison,
} from "@/app/admin/(dashboard)/sources/actions";
import { ETAT_VIDE, type EtatAction } from "@/app/admin/(dashboard)/sources/etat";
import type { ConfigBackendPublique, ResultatSync } from "@/lib/backend/types";

const champ =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const libelle = "block text-xs font-medium text-zinc-500";
const boutonPrincipal =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";
const boutonSecondaire =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

function Message({ etat }: { etat: EtatAction }) {
  if (etat.statut === "vide") return null;
  const erreur = etat.statut === "erreur";
  return (
    <p
      role="status"
      className={`rounded-md border px-4 py-2 text-sm ${
        erreur
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400"
      }`}
    >
      {etat.message}
      {etat.detail && (
        <span className="mt-1 block text-xs opacity-80">{etat.detail}</span>
      )}
    </p>
  );
}

function ResumeSync({ resultat }: { resultat: ResultatSync }) {
  if (resultat.statut === "erreur") {
    return <Message etat={{ statut: "erreur", message: resultat.message ?? "Échec" }} />;
  }
  if (resultat.statut === "ignore") {
    return (
      <Message
        etat={{ statut: "erreur", message: resultat.message ?? "Passage ignoré" }}
      />
    );
  }
  return (
    <Message
      etat={{
        statut: "ok",
        message: `${resultat.lignesRecues} session(s) reçue(s) en ${(
          resultat.dureeMs / 1000
        ).toFixed(1)} s.`,
        detail:
          `${resultat.sessionsCreees} créée(s), ${resultat.sessionsMajs} mise(s) à jour, ` +
          `${resultat.sessionsRetirees} retirée(s) · ${resultat.organismesCrees} organisme(s), ` +
          `${resultat.domainesCrees} domaine(s), ${resultat.centresCrees} centre(s), ` +
          `${resultat.formationsCreees} formation(s) créé(e)s`,
      }}
    />
  );
}

export function LiaisonBackend({ config }: { config: ConfigBackendPublique }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [mode, setMode] = useState(config.mode);
  const [etat, setEtat] = useState<EtatAction>(ETAT_VIDE);
  const [resultat, setResultat] = useState<ResultatSync | null>(null);
  const [purgeOuverte, setPurgeOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [action, setAction] = useState<"aucune" | "enregistrer" | "tester" | "sync" | "purge">(
    "aucune"
  );

  function executer(
    nom: typeof action,
    travail: () => Promise<EtatAction | ResultatSync>
  ) {
    setEtat(ETAT_VIDE);
    setResultat(null);
    setAction(nom);
    demarrer(async () => {
      try {
        const retour = await travail();
        if ("statut" in retour && "lignesRecues" in retour) {
          setResultat(retour as ResultatSync);
        } else {
          setEtat(retour as EtatAction);
        }
      } catch (err) {
        setEtat({
          statut: "erreur",
          message: err instanceof Error ? err.message : "Erreur inattendue",
        });
      } finally {
        setAction("aucune");
        router.refresh();
      }
    });
  }

  function donnees() {
    return new FormData(formRef.current!);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 className="text-base font-semibold">Liaison avec le backend de veille</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Rapatrie automatiquement les sessions collectées par le scraper. Les
          données saisies ou importées à la main ne sont jamais écrasées.
        </p>
      </div>

      <form ref={formRef} className="flex flex-col gap-4">
        <div>
          <label htmlFor="mode" className={libelle}>
            Mode
          </label>
          <select
            id="mode"
            name="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className={champ}
          >
            <option value="off">Désactivée (import manuel uniquement)</option>
            <option value="http">API HTTP du backend</option>
            <option value="sqlite">Fichier SQLite du backend (même machine)</option>
          </select>
        </div>

        {mode === "http" && (
          <>
            <div>
              <label htmlFor="url" className={libelle}>
                Adresse du backend
              </label>
              <input
                id="url"
                name="url"
                type="url"
                defaultValue={config.url}
                placeholder="http://localhost:8000"
                className={champ}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Sans le suffixe /api : le site appelle /api/sante et
                /api/sessions.
              </p>
            </div>
            <div>
              <label htmlFor="token" className={libelle}>
                Jeton d&apos;API {config.tokenDefini && "(déjà défini)"}
              </label>
              <input
                id="token"
                name="token"
                type="password"
                autoComplete="off"
                placeholder={
                  config.tokenDefini ? "Laisser vide pour conserver" : "WEBAPP_API_TOKEN du backend"
                }
                className={champ}
              />
              {config.tokenDefini && (
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  <input type="checkbox" name="effacerToken" /> Effacer le jeton
                  enregistré
                </label>
              )}
            </div>
          </>
        )}

        {mode === "sqlite" && (
          <div>
            <label htmlFor="dbPath" className={libelle}>
              Chemin du fichier formations.db
            </label>
            <input
              id="dbPath"
              name="dbPath"
              defaultValue={config.dbPath}
              placeholder="../data/formations.db"
              className={champ}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Relatif au dossier de lancement du site. Le fichier est ouvert en
              lecture seule : le scraper reste seul à écrire.
            </p>
          </div>
        )}

        {mode !== "off" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ttlMinutes" className={libelle}>
                Fraîcheur maximale (minutes)
              </label>
              <input
                id="ttlMinutes"
                name="ttlMinutes"
                type="number"
                min={1}
                defaultValue={config.ttlMinutes}
                className={champ}
              />
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="autoSync"
                  defaultChecked={config.autoSync}
                />
                Synchroniser automatiquement à la visite du site
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="inclurePassees"
                  defaultChecked={config.inclurePassees}
                />
                Rapatrier aussi les sessions passées
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={enCours}
            onClick={() =>
              executer("enregistrer", () => enregistrerLiaison(ETAT_VIDE, donnees()))
            }
            className={boutonPrincipal}
          >
            {action === "enregistrer" ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            disabled={enCours || mode === "off"}
            onClick={() => executer("tester", () => testerLiaison(ETAT_VIDE, donnees()))}
            className={boutonSecondaire}
          >
            {action === "tester" ? "Test…" : "Tester la connexion"}
          </button>
          <button
            type="button"
            disabled={enCours || config.mode === "off"}
            onClick={() => executer("sync", () => lancerSynchronisation())}
            className={boutonSecondaire}
            title={
              config.mode === "off"
                ? "Enregistrez d'abord un mode de liaison"
                : undefined
            }
          >
            {action === "sync" ? "Synchronisation…" : "Synchroniser maintenant"}
          </button>
        </div>
      </form>

      <Message etat={etat} />
      {resultat && <ResumeSync resultat={resultat} />}

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setPurgeOuverte(true)}
          className="text-sm text-red-600 hover:underline"
        >
          Retirer les données issues du backend
        </button>
        <p className="mt-1 text-xs text-zinc-500">
          Ne touche pas aux données saisies ou importées à la main. La
          synchronisation suivante les reconstruit depuis le backend.
        </p>
      </div>

      {purgeOuverte && (
        <Modal onClose={() => setPurgeOuverte(false)} title="Retirer les données du backend">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
            Retirer les données du backend ?
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Toutes les sessions synchronisées seront supprimées, ainsi que les
            formations, centres, domaines et organismes créés par la
            synchronisation et devenus vides. Les données manuelles restent en
            place.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setPurgeOuverte(false)}
              className={boutonSecondaire}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => {
                setPurgeOuverte(false);
                executer("purge", () => purgerDonneesBackend());
              }}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Retirer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
