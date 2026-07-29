import { revalidatePath } from "next/cache";

const CHEMINS = [
  "/formations",
  "/organismes",
  "/admin",
  "/admin/formations",
  "/admin/organismes",
  "/admin/domaines",
  "/admin/sources",
];

// Invalide les pages qui affichent le catalogue après un import ou une
// synchronisation. `revalidatePath` exige un contexte de requête : appelée
// depuis `after()` pendant le rendu d'une page, elle peut ne pas être
// disponible — l'échec ne doit pas faire tomber la synchronisation, les pages
// se rafraîchiront à la visite suivante.
export function revaliderCatalogue(): void {
  for (const chemin of CHEMINS) {
    try {
      revalidatePath(chemin);
    } catch {
      return;
    }
  }
}
