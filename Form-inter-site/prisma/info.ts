/**
 * `npm run db:info` — où est la base, et qu'y a-t-il dedans.
 *
 * Deux allers-retours ont été perdus à deviner si le seed avait tourné, s'il
 * avait écrit ailleurs, ou si le site lisait un autre fichier. La question se
 * répond en trois lignes : autant les imprimer.
 */
import path from "node:path";
import fs from "node:fs";
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { urlBaseDonnees } from "../src/lib/database-url";

async function main() {
  const url = urlBaseDonnees();

  // Le site et la CLI résolvent `file:./x.db` depuis le dossier de lancement :
  // c'est cette résolution-là qu'on veut montrer, pas l'URL brute.
  const chemin = url.startsWith("file:")
    ? path.resolve(process.cwd(), url.slice("file:".length))
    : url;

  console.log(`URL      ${url}`);
  console.log(`Fichier  ${chemin}`);

  if (!fs.existsSync(chemin)) {
    console.log("\nCe fichier n'existe pas encore.");
    console.log(
      "→ npm run db:demo   (crée le schéma et pose un catalogue de démonstration)",
    );
    process.exit(0);
  }

  const octets = fs.statSync(chemin).size;
  console.log(`Taille   ${(octets / 1024).toFixed(0)} ko\n`);

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });

  try {
    const [organismes, centres, domaines, formations, sessions, comptes] =
      await Promise.all([
        prisma.organisme.count(),
        prisma.centre.count(),
        prisma.domaine.count(),
        prisma.formation.count(),
        prisma.session.count(),
        prisma.adminUser.count(),
      ]);

    console.log(
      `${organismes} organismes, ${centres} centres, ${domaines} domaines`,
    );
    console.log(`${formations} formations, ${sessions} sessions`);
    console.log(`${comptes} compte(s) d'administration`);

    if (formations === 0) {
      console.log("\nLe schéma est là mais le catalogue est vide.");
      console.log(
        "→ npm run db:demo   (catalogue de démonstration, sans backend)",
      );
    }
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    if (/does not exist/i.test(message)) {
      console.log("Le fichier existe mais n'a pas le schéma du site.");
      console.log("→ npm run db:setup  (applique les migrations)");
    } else {
      throw erreur;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
