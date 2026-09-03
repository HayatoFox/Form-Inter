/**
 * Amorçage : rend le site utilisable dès le premier lancement.
 *
 * Il est appelé par `npm run dev`, avant le serveur. Deux constats l'ont
 * imposé.
 *
 * D'abord, une base migrée mais vide ne montre rien, et rien n'indiquait qu'il
 * fallait lancer une commande de plus. Ensuite — et c'est le pire — le compte
 * du back office n'était affiché que par `db:demo`. Qui démarrait avec
 * `npm run dev` n'avait jamais l'identifiant, et se retrouvait devant un écran
 * de connexion sans moyen d'entrer.
 *
 * Le script est donc idempotent et bavard :
 *   - catalogue vide → il pose le jeu de démonstration ;
 *   - aucun compte → il en crée un ;
 *   - dans tous les cas, il RAPPELLE les identifiants à l'écran.
 *
 * Il ne touche jamais à des données existantes : sur une base déjà remplie, il
 * se contente d'afficher où on en est.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { urlBaseDonnees } from "../src/lib/database-url";

// L'adresse par défaut doit être une adresse VALIDE : le formulaire de
// connexion la valide avec `z.string().email()`, qui refuse « admin@local »
// faute de point. Le compte existait, le mot de passe était bon, et la
// connexion répondait « Email ou mot de passe invalide » — un 400 de
// validation qu'on lisait comme un échec d'authentification.
const EMAIL_DEFAUT = "admin@proinsec.local";
const MOT_DE_PASSE_DEFAUT = "demo";

function encadre(lignes: string[]) {
  const largeur = Math.max(...lignes.map((l) => l.length));
  const barre = "─".repeat(largeur + 2);
  console.log(`\n┌${barre}┐`);
  for (const l of lignes) console.log(`│ ${l.padEnd(largeur)} │`);
  console.log(`└${barre}┘\n`);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: urlBaseDonnees() }),
  });

  try {
    const [formations, comptes] = await Promise.all([
      prisma.formation.count(),
      prisma.adminUser.count(),
    ]);

    // Le catalogue d'abord : le jeu de démonstration crée aussi son compte.
    if (formations === 0) {
      console.log("Catalogue vide : mise en place du jeu de démonstration…");
      await prisma.$disconnect();
      execFileSync("npx", ["tsx", path.join(__dirname, "seed-demo.ts")], {
        stdio: "inherit",
      });
      encadre([
        "Jeu de démonstration en place.",
        "",
        "Back office : /admin",
        `  identifiant  ${process.env.ADMIN_EMAIL ?? EMAIL_DEFAUT}`,
        `  mot de passe ${process.env.ADMIN_PASSWORD_SEED ?? MOT_DE_PASSE_DEFAUT}`,
      ]);
      return;
    }

    if (comptes === 0) {
      // Catalogue rempli mais aucun compte : le cas d'une base alimentée par le
      // backend sans passer par un seed. Sans ce rattrapage, le back office est
      // inaccessible et rien ne le dit.
      const email = process.env.ADMIN_EMAIL ?? EMAIL_DEFAUT;
      const motDePasse = process.env.ADMIN_PASSWORD_SEED ?? MOT_DE_PASSE_DEFAUT;
      await prisma.adminUser.create({
        data: { email, passwordHash: await bcrypt.hash(motDePasse, 10) },
      });
      encadre([
        "Aucun compte d'administration : un compte a été créé.",
        "",
        "Back office : /admin",
        `  identifiant  ${email}`,
        `  mot de passe ${motDePasse}`,
      ]);
      return;
    }

    const [centres, situes] = await Promise.all([
      prisma.centre.count(),
      prisma.centre.count({ where: { geoStatut: "ok" } }),
    ]);

    const lignes = [
      `${formations} formation(s), ${centres} centre(s) dont ${situes} situé(s).`,
      "",
      `Back office : /admin — compte existant (${comptes}).`,
    ];
    if (situes < centres) {
      lignes.push("");
      lignes.push("Centres sans coordonnées : Admin › Sources de données,");
      lignes.push("bouton « Localiser les centres manquants ».");
    }
    encadre(lignes);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((erreur) => {
  // L'amorçage ne doit jamais empêcher le serveur de démarrer : il rend
  // service, il ne conditionne rien.
  console.error("Amorçage impossible :", erreur instanceof Error ? erreur.message : erreur);
});
