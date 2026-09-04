import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  ConfigBackend,
  ConfigBackendPublique,
  ModeBackend,
} from "@/lib/backend/types";

// Configuration de la liaison avec le backend de veille.
//
// Deux niveaux : les variables d'environnement donnent les valeurs de départ
// d'un déploiement, la table `Reglage` porte ce que l'admin modifie depuis le
// back office. Une valeur en base l'emporte toujours sur l'environnement, ce
// qui permet de livrer une image avec des défauts et de les ajuster ensuite
// sans redéploiement.

export type { ConfigBackend, ConfigBackendPublique, ModeBackend };

const PREFIXE = "backend.";

export const CLES = {
  mode: `${PREFIXE}mode`,
  url: `${PREFIXE}url`,
  dbPath: `${PREFIXE}dbPath`,
  token: `${PREFIXE}token`,
  autoSync: `${PREFIXE}autoSync`,
  ttlMinutes: `${PREFIXE}ttlMinutes`,
  inclurePassees: `${PREFIXE}inclurePassees`,
  verrou: `${PREFIXE}verrou`,
} as const;

const DEFAUTS: ConfigBackend = {
  mode: "off",
  url: "",
  // Disposition de dépôt attendue : le backend est à la racine, le site dans
  // Form-inter-site/, la base partagée dans data/.
  dbPath: "../data/formations.db",
  token: "",
  autoSync: true,
  ttlMinutes: 60,
  inclurePassees: false,
};

function modeValide(valeur: string | undefined): ModeBackend | null {
  return valeur === "off" || valeur === "http" || valeur === "sqlite"
    ? valeur
    : null;
}

function booleen(valeur: string | undefined, defaut: boolean): boolean {
  if (valeur === undefined || valeur === "") return defaut;
  return ["1", "true", "oui", "on", "yes"].includes(valeur.toLowerCase());
}

function entier(valeur: string | undefined, defaut: number): number {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaut;
}

/**
 * Les réglages tiennent en sept lignes et ne changent qu'à la main, depuis
 * Admin › Sources de données. Les relire à chaque rendu de page — ce qui était
 * le cas, `planifierSyncAuto()` étant appelé par l'accueil et par la liste —
 * revenait à une requête de plus sur le chemin de TOUTE réponse. On les garde
 * donc en mémoire, et l'écriture invalide le cache elle-même : la valeur est
 * juste dès la soumission du formulaire, pas au bout d'un délai.
 *
 * Le cache est par processus : deux instances derrière un répartiteur de
 * charge peuvent diverger le temps d'un délai. Le site tourne sur une machine,
 * en un exemplaire, et un mode de liaison qui met une minute à se propager
 * n'aurait de toute façon aucune conséquence.
 */
let cacheReglages: Record<string, string> | null = null;

export function oublierConfigBackend(): void {
  cacheReglages = null;
}

async function lireReglages(): Promise<Record<string, string>> {
  if (cacheReglages) return cacheReglages;
  const lignes = await prisma.reglage.findMany({
    where: { cle: { startsWith: PREFIXE } },
    select: { cle: true, valeur: true },
  });
  cacheReglages = Object.fromEntries(lignes.map((r) => [r.cle, r.valeur]));
  return cacheReglages;
}

export async function lireConfigBackend(): Promise<ConfigBackend> {
  const reglages = await lireReglages();
  const env = process.env;

  const depuis = (cle: string, variable: string | undefined) =>
    reglages[cle] ?? variable ?? undefined;

  return {
    mode:
      modeValide(depuis(CLES.mode, env.BACKEND_MODE)) ?? DEFAUTS.mode,
    url: (depuis(CLES.url, env.BACKEND_URL) ?? DEFAUTS.url).replace(/\/+$/, ""),
    dbPath: depuis(CLES.dbPath, env.BACKEND_DB_PATH) ?? DEFAUTS.dbPath,
    token: depuis(CLES.token, env.BACKEND_TOKEN) ?? DEFAUTS.token,
    autoSync: booleen(
      depuis(CLES.autoSync, env.BACKEND_AUTO_SYNC),
      DEFAUTS.autoSync
    ),
    ttlMinutes: entier(
      depuis(CLES.ttlMinutes, env.BACKEND_SYNC_TTL_MINUTES),
      DEFAUTS.ttlMinutes
    ),
    inclurePassees: booleen(
      depuis(CLES.inclurePassees, env.BACKEND_INCLURE_PASSEES),
      DEFAUTS.inclurePassees
    ),
  };
}

export async function lireConfigBackendPublique(): Promise<ConfigBackendPublique> {
  const { token, ...reste } = await lireConfigBackend();
  return { ...reste, tokenDefini: token.length > 0 };
}

export type ModificationConfig = Partial<{
  mode: ModeBackend;
  url: string;
  dbPath: string;
  /** `null` efface le jeton, `undefined` le laisse inchangé. */
  token: string | null;
  autoSync: boolean;
  ttlMinutes: number;
  inclurePassees: boolean;
}>;

export async function ecrireConfigBackend(
  modification: ModificationConfig
): Promise<void> {
  const ecritures: { cle: string; valeur: string }[] = [];
  const supprimees: string[] = [];

  const poser = (cle: string, valeur: string | null | undefined) => {
    if (valeur === undefined) return;
    if (valeur === null) supprimees.push(cle);
    else ecritures.push({ cle, valeur });
  };

  poser(CLES.mode, modification.mode);
  poser(CLES.url, modification.url?.replace(/\/+$/, ""));
  poser(CLES.dbPath, modification.dbPath);
  // Un jeton vide vaut effacement : le champ du formulaire est laissé vide
  // quand on ne veut pas retoucher au jeton, l'effacement passe par null.
  poser(CLES.token, modification.token === "" ? null : modification.token);
  poser(
    CLES.autoSync,
    modification.autoSync === undefined
      ? undefined
      : modification.autoSync
        ? "1"
        : "0"
  );
  poser(
    CLES.ttlMinutes,
    modification.ttlMinutes === undefined
      ? undefined
      : String(modification.ttlMinutes)
  );
  poser(
    CLES.inclurePassees,
    modification.inclurePassees === undefined
      ? undefined
      : modification.inclurePassees
        ? "1"
        : "0"
  );

  for (const { cle, valeur } of ecritures) {
    await prisma.reglage.upsert({
      where: { cle },
      update: { valeur },
      create: { cle, valeur },
    });
  }
  if (supprimees.length > 0) {
    await prisma.reglage.deleteMany({ where: { cle: { in: supprimees } } });
  }
  // Le cache de lecture doit tomber ICI, et pas au bout d'un délai : sinon
  // l'écran qui vient d'enregistrer un changement de mode le réafficherait
  // avec l'ancienne valeur.
  oublierConfigBackend();
}

export function libelleMode(mode: ModeBackend): string {
  return {
    off: "Désactivée",
    http: "API HTTP du backend",
    sqlite: "Fichier SQLite du backend",
  }[mode];
}
