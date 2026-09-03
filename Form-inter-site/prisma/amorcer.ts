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
 *   - pas de SESSION_SECRET → il en tire un et l'écrit dans .env ;
 *   - catalogue vide → il pose le jeu de démonstration ;
 *   - aucun compte → il en crée un ;
 *   - dans tous les cas, il RAPPELLE les identifiants à l'écran.
 *
 * Il ne touche jamais à des données existantes : sur une base déjà remplie, il
 * se contente d'afficher où on en est.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
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

const RACINE = path.join(__dirname, "..");

/**
 * Le cookie d'administration est signé avec SESSION_SECRET. Sans clé, la
 * connexion partait en 500 (« SESSION_SECRET n'est pas défini dans .env ») :
 * une erreur serveur, illisible depuis le formulaire, pour une variable dont
 * rien ne rappelait qu'il fallait la remplir soi-même.
 *
 * Une clé de développement n'a aucune raison d'être saisie à la main : on la
 * tire au sort. La règle est stricte — on n'écrase JAMAIS une clé existante,
 * sous peine de déconnecter tout le monde à chaque démarrage — et on ne touche
 * pas au fichier quand la variable vient de l'environnement (Docker, CI).
 */
function assurerSecret() {
  if (process.env.SESSION_SECRET) return;

  const secret = randomBytes(32).toString("hex");
  const chemin = path.join(RACINE, ".env");
  const exemple = path.join(RACINE, ".env.example");

  let contenu = "";
  if (fs.existsSync(chemin)) {
    contenu = fs.readFileSync(chemin, "utf8");
  } else if (fs.existsSync(exemple)) {
    // Pas de .env du tout : on part du modèle commenté plutôt que d'un fichier
    // nu, pour que les autres réglages restent documentés sur place.
    contenu = fs.readFileSync(exemple, "utf8");
  }

  // La ligne existe mais est vide (`SESSION_SECRET=""`, le cas du .env.example
  // recopié tel quel) : on la remplit sur place, sinon on l'ajoute.
  const ligneVide = /^(\s*SESSION_SECRET\s*=\s*)(""|''|)\s*$/m;
  if (ligneVide.test(contenu)) {
    contenu = contenu.replace(ligneVide, `SESSION_SECRET="${secret}"`);
  } else {
    if (contenu && !contenu.endsWith("\n")) contenu += "\n";
    contenu += `\n# Clé générée automatiquement au premier démarrage.\nSESSION_SECRET="${secret}"\n`;
  }

  fs.writeFileSync(chemin, contenu, { mode: 0o600 });
  process.env.SESSION_SECRET = secret;
  console.log(
    "SESSION_SECRET manquant : une clé a été générée et écrite dans .env."
  );
}

function encadre(lignes: string[]) {
  const largeur = Math.max(...lignes.map((l) => l.length));
  const barre = "─".repeat(largeur + 2);
  console.log(`\n┌${barre}┐`);
  for (const l of lignes) console.log(`│ ${l.padEnd(largeur)} │`);
  console.log(`└${barre}┘\n`);
}

async function main() {
  // Avant toute chose : sans clé de session, le back office est inaccessible
  // même avec un compte valide. Un .env non inscriptible ne doit pas pour
  // autant empêcher le reste de l'amorçage.
  try {
    assurerSecret();
  } catch (erreur) {
    console.error(
      "SESSION_SECRET manquant et .env non modifiable :",
      erreur instanceof Error ? erreur.message : erreur
    );
    console.error(
      'Ajouter à la main : SESSION_SECRET="$(openssl rand -hex 32)"'
    );
  }

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

    // Base déjà remplie ET compte déjà créé. C'est le cas de tous les jours,
    // et c'est celui où l'encadré ne disait plus rien d'utile : « compte
    // existant (1) », sans l'identifiant. Qui avait fermé le terminal du
    // premier démarrage se retrouvait devant l'écran de connexion sans savoir
    // quelle adresse taper.
    //
    // Le mot de passe, lui, ne peut pas être rappelé : il n'est stocké que
    // haché, et c'est bien ainsi. À défaut, on donne la commande qui en pose
    // un nouveau.
    const [centres, situes, admins] = await Promise.all([
      prisma.centre.count(),
      prisma.centre.count({ where: { NOT: { latitude: null } } }),
      prisma.adminUser.findMany({ select: { email: true }, orderBy: { email: "asc" } }),
    ]);

    const lignes = [
      `${formations} formation(s), ${centres} centre(s) dont ${situes} sur la carte.`,
      "",
      "Back office : /admin",
    ];
    for (const admin of admins) lignes.push(`  identifiant  ${admin.email}`);
    lignes.push("  mot de passe inchangé, et non récupérable (haché)");
    lignes.push("");
    lignes.push("Oublié ? npm run admin:motdepasse");
    if (situes < centres) {
      lignes.push("");
      lignes.push(`${centres - situes} centre(s) hors carte : Admin › Centres`);
      lignes.push("pour saisir leur adresse, ou Sources de données pour");
      lignes.push("lancer une localisation automatique.");
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
