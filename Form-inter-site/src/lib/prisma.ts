import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { urlBaseDonnees } from "@/lib/database-url";
import { appliquerReglagesSqlite } from "@/lib/sqlite-reglages";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaBetterSqlite3({ url: urlBaseDonnees() });

const client = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Les pragmas sont posés une seule fois, sur le client neuf : ils valent pour
// la connexion, et les reposer à chaque rechargement de module en
// développement ne servirait à rien.
if (!globalForPrisma.prisma) appliquerReglagesSqlite(client);

export const prisma = client;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
