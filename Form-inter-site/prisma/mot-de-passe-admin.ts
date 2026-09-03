/**
 * Poser un nouveau mot de passe sur le compte du back office.
 *
 * L'amorçage rappelle l'identifiant à chaque démarrage, mais pas le mot de
 * passe : il n'est stocké que haché, et c'est bien ainsi. Il fallait donc une
 * porte de sortie pour le cas — le plus banal — où on l'a oublié.
 *
 *   npm run admin:motdepasse                  → en tire un au sort et l'affiche
 *   npm run admin:motdepasse -- secret        → pose celui-là
 *   npm run admin:motdepasse -- secret a@b.fr → sur ce compte-là
 *
 * Sans compte existant, il en crée un. Avec plusieurs, il exige l'adresse
 * plutôt que de deviner lequel.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { urlBaseDonnees } from "../src/lib/database-url";

const EMAIL_DEFAUT = "admin@proinsec.local";

function encadre(lignes: string[]) {
  const largeur = Math.max(...lignes.map((l) => l.length));
  const barre = "─".repeat(largeur + 2);
  console.log(`\n┌${barre}┐`);
  for (const l of lignes) console.log(`│ ${l.padEnd(largeur)} │`);
  console.log(`└${barre}┘\n`);
}

async function main() {
  const [motDePasseDemande, emailDemande] = process.argv.slice(2);
  // Un mot de passe tiré au sort vaut mieux qu'un défaut connu de tous, et
  // celui-ci s'affiche une fois — il n'est pas récupérable ensuite.
  const motDePasse = motDePasseDemande || randomBytes(6).toString("base64url");

  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: urlBaseDonnees() }),
  });

  try {
    const comptes = await prisma.adminUser.findMany({
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });

    let email = emailDemande;
    if (!email) {
      if (comptes.length > 1) {
        console.error(
          `${comptes.length} comptes existent : précisez lequel.\n` +
            comptes.map((c) => `  npm run admin:motdepasse -- <mot de passe> ${c.email}`).join("\n")
        );
        process.exitCode = 1;
        return;
      }
      email = comptes[0]?.email ?? process.env.ADMIN_EMAIL ?? EMAIL_DEFAUT;
    }

    const passwordHash = await bcrypt.hash(motDePasse, 10);
    const existant = comptes.find((c) => c.email === email);

    if (existant) {
      await prisma.adminUser.update({
        where: { id: existant.id },
        data: { passwordHash },
      });
    } else {
      await prisma.adminUser.create({ data: { email, passwordHash } });
    }

    encadre([
      existant ? "Mot de passe remplacé." : "Compte créé.",
      "",
      "Back office : /admin",
      `  identifiant  ${email}`,
      `  mot de passe ${motDePasse}`,
      "",
      "Il ne sera plus affiché : notez-le maintenant.",
    ]);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((erreur) => {
  console.error(
    "Changement impossible :",
    erreur instanceof Error ? erreur.message : erreur
  );
  process.exitCode = 1;
});
