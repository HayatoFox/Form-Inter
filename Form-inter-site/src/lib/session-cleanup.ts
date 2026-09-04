import { prisma } from "@/lib/prisma";
import { MANUEL } from "@/lib/backend/types";
import { debutDuJour } from "@/lib/dates";

// Supprime les sessions terminées **saisies ou importées à la main**. Appelé au
// chargement des pages de consultation les plus fréquentées : il n'y a pas de
// tâche planifiée en arrière-plan, le nettoyage se déclenche donc à la
// prochaine visite plutôt qu'à une heure fixe.
//
// Les sessions issues du backend en sont exclues : c'est la synchronisation qui
// décide de leur sort (une session que le backend ne publie plus disparaît au
// passage suivant). Les supprimer ici les ferait réapparaître puis disparaître
// à chaque cycle.
//
// Les sessions à entrée/sortie permanente (sans date de début) ne se périment
// jamais.
// Le ménage ne concerne que des sessions DATÉES : entre deux passages de
// minuit, il n'y a rien de nouveau à supprimer. Le refaire à chaque affichage
// revenait à lancer une ÉCRITURE — donc à prendre un verrou — pour un résultat
// presque toujours vide. On ne repasse donc qu'une fois par jour et par
// processus. Le pire cas est une session périmée qui reste visible quelques
// heures de plus sur un serveur redémarré ; ce n'est pas un prix.
let dernierMenage = "";

export async function cleanupPastSessions() {
  const aujourdhui = debutDuJour();
  const jour = aujourdhui.toISOString().slice(0, 10);
  if (dernierMenage === jour) return;
  dernierMenage = jour;

  await prisma.session.deleteMany({
    where: {
      source: MANUEL,
      dateDebut: { not: null },
      OR: [
        { dateFin: { not: null, lt: aujourdhui } },
        { dateFin: null, dateDebut: { lt: aujourdhui } },
      ],
    },
  });
}
