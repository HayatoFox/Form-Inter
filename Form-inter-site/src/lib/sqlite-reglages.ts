import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Les réglages SQLite, posés à l'ouverture de la connexion.
 *
 * SQLite démarre dans sa configuration la plus prudente et la plus lente, et
 * personne ne l'avait changée. Mesuré sur la base du projet, 500 écritures :
 *
 *   journal_mode=delete, synchronous=FULL  →  362 ms
 *   journal_mode=wal,    synchronous=NORMAL →   5 ms
 *
 * Soixante-douze fois. Et le chiffre brut n'est pas le pire : en mode
 * `delete`, une écriture prend un verrou EXCLUSIF qui bloque tous les
 * lecteurs. Comme la synchronisation avec le backend écrit des milliers de
 * lignes et qu'elle part à la visite d'une page, le site se figeait pendant
 * qu'elle tournait — jusqu'à `busy_timeout`, cinq secondes, avant d'échouer.
 * C'est très probablement ce que l'utilisateur ressentait comme « lent ».
 *
 * Ce qui est posé, et pourquoi :
 *
 * - **WAL** : lecteurs et écrivain avancent en parallèle. C'est LE réglage qui
 *   change tout pour un site qui lit pendant qu'il synchronise. Il est inscrit
 *   dans le fichier, donc persistant — mais on le repose à chaque démarrage,
 *   une base restaurée depuis une sauvegarde revenant en `delete`.
 * - **synchronous=NORMAL** : sous WAL, c'est le réglage recommandé par SQLite.
 *   On ne perd de données que si le SYSTÈME tombe (pas si le processus meurt),
 *   et la donnée perdue serait au pire la dernière synchronisation — que le
 *   passage suivant refait.
 * - **busy_timeout** relevé à 15 s : la synchronisation reste une longue
 *   écriture, et mieux vaut une requête qui attend qu'une requête qui échoue.
 * - **mmap_size** et **temps de cache** : la base tient dans quelques mégaoctets,
 *   autant la lire en mémoire projetée plutôt que par appels système.
 * - **wal_autocheckpoint** un peu relevé : moins de fusions du journal pendant
 *   les rafales d'écriture de la synchronisation.
 *
 * Le tout passe par `$executeRawUnsafe` : ni Prisma ni l'adaptateur
 * better-sqlite3 n'exposent les pragmas dans leur configuration. Les
 * instructions sont émises à la création du client, donc avant toute requête
 * applicative — l'adaptateur n'ouvre qu'une connexion et respecte l'ordre.
 */

const REGLAGES = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA busy_timeout = 15000",
  "PRAGMA temp_store = MEMORY",
  "PRAGMA mmap_size = 134217728",
  "PRAGMA cache_size = -32000",
  "PRAGMA wal_autocheckpoint = 2000",
];

export function appliquerReglagesSqlite(prisma: PrismaClient): void {
  void (async () => {
    for (const reglage of REGLAGES) {
      try {
        await prisma.$executeRawUnsafe(reglage);
      } catch (erreur) {
        // Un pragma refusé ne doit pas empêcher le site de démarrer : il
        // tournera simplement avec les valeurs par défaut, comme avant.
        console.warn(
          `[sqlite] ${reglage} refusé :`,
          erreur instanceof Error ? erreur.message : erreur
        );
      }
    }

    // WAL peut être REFUSÉ SANS ERREUR : il réclame de la mémoire partagée, ce
    // que certains systèmes de fichiers ne fournissent pas — un montage lié
    // Docker sur macOS ou Windows, un partage réseau. SQLite garde alors
    // silencieusement l'ancien mode, et on se retrouverait à croire le
    // problème réglé alors que les lecteurs sont toujours bloqués. On relit
    // donc ce qui a vraiment été retenu.
    try {
      const lu = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>(
        "PRAGMA journal_mode"
      );
      const mode = lu?.[0]?.journal_mode?.toLowerCase();
      if (mode && mode !== "wal") {
        console.warn(
          `[sqlite] WAL refusé, la base reste en mode « ${mode} » : les lectures ` +
            "seront bloquées pendant les écritures. Cause probable : la base est " +
            "sur un montage qui ne gère pas la mémoire partagée (volume lié " +
            "Docker sur macOS/Windows, partage réseau). La déplacer sur un " +
            "volume Docker nommé règle le problème."
        );
      }
    } catch {
      // Relecture impossible : sans importance, on n'en tire qu'un message.
    }
  })();
}
