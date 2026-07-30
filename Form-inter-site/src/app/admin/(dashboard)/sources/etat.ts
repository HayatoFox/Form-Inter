// Retour d'une action du formulaire de liaison, partagé entre les Server
// Actions et le composant client (un fichier "use server" ne peut exporter que
// des fonctions asynchrones).
export type EtatAction = {
  statut: "vide" | "ok" | "erreur";
  message: string;
  detail?: string;
};

export const ETAT_VIDE: EtatAction = { statut: "vide", message: "" };
