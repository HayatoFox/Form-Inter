// Chargé par la CLI Prisma, hors du graphe Next : import relatif obligatoire,
// les alias de chemin (`@/`) n'y sont pas résolus.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { urlBaseDonnees } from "./src/lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Même résolution que l'application : sans cela, un `.env` sans
    // DATABASE_URL laissait l'app démarrer sur `dev.db` pendant que la CLI
    // refusait de migrer, et le schéma n'était jamais créé.
    url: urlBaseDonnees(),
  },
});
