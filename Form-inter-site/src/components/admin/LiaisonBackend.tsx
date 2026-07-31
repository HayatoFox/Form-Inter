"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialogue } from "@/components/ui/Dialogue";
import {
  enregistrerLiaison,
  lancerSynchronisation,
  purgerDonneesBackend,
  testerLiaison,
} from "@/app/admin/(dashboard)/sources/actions";
import { ETAT_VIDE, type EtatAction } from "@/app/admin/(dashboard)/sources/etat";
import type { ConfigBackendPublique, ResultatSync } from "@/lib/backend/types";

const champ =
  "mt-1.5 w-full rounded-[var(--rayon)] bg-surface px-3 py-2 text-sm text-encre shadow-[inset_0_0_0_1px_var(--trait)] placeholder:text-encre-4 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--trait-fort)]";
const libelle = "block text-[13px] text-encre-3";
const boutonPrincipal =
  "inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-action px-4 py-2 text-sm font-medium text-action-texte transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-40";
const boutonSecondaire =
  "inline-flex items-center justify-center rounded-[var(--rayon)] bg-surface-creuse px-4 py-2 text-sm font-medium text-encre transition-colors hover:bg-trait disabled:opacity-40";

function Message({ etat }: { etat: EtatAction }) {
  if (etat.statut === "vide") return null;
  const erreur = etat.statut === "erreur";
  return (
    <p
      role="status"
      className={`rounded-[var(--rayon)] border px-4 py-2 text-sm ${
        erreur
          ? "border-erreur/30 bg-erreur-doux text-erreur"
          : "border-vif/25 bg-vif-doux text-vif"
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
    <div className="flex flex-col gap-4 cadre p-6">
      <div>
        <h2 className="text-base font-semibold">Liaison avec le backend de veille</h2>
        <p className="mt-1 text-sm text-encre-2">
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
              <p className="mt-1 text-xs text-encre-2">
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
                <label className="mt-2 flex items-center gap-2 text-xs text-encre-2">
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
            <p className="mt-1 text-xs text-encre-2">
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

      <div className="border-t border-trait pt-4">
        <button
          type="button"
          onClick={() => setPurgeOuverte(true)}
          className="text-sm text-erreur hover:underline"
        >
          Retirer les données issues du backend
        </button>
        <p className="mt-1 text-xs text-encre-2">
          Ne touche pas aux données saisies ou importées à la main. La
          synchronisation suivante les reconstruit depuis le backend.
        </p>
      </div>

      <Dialogue
          ouvert={purgeOuverte}
          onFermer={() => setPurgeOuverte(false)}
          titre="Retirer les données du backend ?"
          description="Toutes les sessions synchronisées seront supprimées, ainsi que les formations, centres, domaines et organismes créés par la synchronisation et devenus vides. Les données manuelles restent en place."
        >
          <h3 className="text-lg font-semibold text-erreur">
            Retirer les données du backend ?
          </h3>
          <p className="mt-2 text-sm text-encre-2 dark:text-encre-3">
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
              className="rounded-[var(--rayon)] bg-erreur px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Retirer
            </button>
          </div>
        </Dialogue>
    </div>
  );
}
