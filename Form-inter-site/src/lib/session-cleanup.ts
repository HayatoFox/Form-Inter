import { prisma } from "@/lib/prisma";

// Supprime définitivement les sessions dont la date de début est passée.
// Appelé au chargement des pages de consultation les plus fréquentées :
// il n'y a pas de tâche planifiée en arrière-plan, le nettoyage se déclenche
// donc à la prochaine visite plutôt qu'à une heure fixe.
export async function cleanupPastSessions() {
  await prisma.session.deleteMany({
    where: { dateDebut: { lt: new Date() } },
  });
}
