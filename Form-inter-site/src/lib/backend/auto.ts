import "server-only";
import { after } from "next/server";
import { lireConfigBackend } from "@/lib/backend/config";
import { dernierPassageReussi, synchroniser } from "@/lib/backend/sync";
import { revaliderCatalogue } from "@/lib/revalidation";
import { localiserCentres } from "@/lib/geo/centres";

// Rafraîchissement automatique : le site n'a pas de tâche planifiée en propre,
// la synchronisation part donc à la visite d'une page de consultation quand le
// dernier passage réussi date de plus de `ttlMinutes`. `after()` la fait
// tourner une fois la réponse envoyée : le visiteur n'attend jamais le backend.
//
// Pour un rafraîchissement à heure fixe, préférer l'appel de /api/cron/sync
// depuis le cron de la machine (jeton CRON_SECRET).

// Évite qu'une rafale de requêtes ne programme des dizaines de passages qui
// se heurteraient tous au verrou. Le verrou en base reste l'arbitre entre
// plusieurs processus.
let dernierePlanification = 0;
const PAUSE_MS = 60_000;

export async function planifierSyncAuto(): Promise<void> {
  const config = await lireConfigBackend();
  if (config.mode === "off" || !config.autoSync) return;

  if (Date.now() - dernierePlanification < PAUSE_MS) return;

  const dernier = await dernierPassageReussi();
  const perime =
    !dernier ||
    Date.now() - dernier.demarreLe.getTime() > config.ttlMinutes * 60_000;
  if (!perime) return;

  dernierePlanification = Date.now();

  after(async () => {
    const resultat = await synchroniser("auto");
    if (resultat.statut === "erreur") {
      console.error("[sync auto]", resultat.message);
    } else if (resultat.statut === "ok") {
      revaliderCatalogue();
      // Un tout petit lot : on est après la réponse, mais le géocodage tient
      // la cadence d'une requête par seconde et un visiteur n'a pas à financer
      // le rattrapage complet. Le passage de nuit s'en charge pour de bon.
      await localiserCentres({ lot: 10 });
    }
  });
}
