import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const organismes = [
  { nom: "Pilocap", siteWeb: "https://formation-pilocap.fr/centres-formation/" },
  { nom: "Temis", siteWeb: "https://www.temis-formation.fr/" },
  { nom: "Cepim", siteWeb: "https://www.cepim.fr/planning/" },
  { nom: "ACN", siteWeb: "https://www.groupe-acn.fr/" },
  { nom: "Voltwork", siteWeb: "https://www.voltwork.fr/" },
  { nom: "Formaphénix", siteWeb: "https://www.formaphenix.fr/" },
];

async function main() {
  for (const organisme of organismes) {
    await prisma.organisme.upsert({
      where: { nom: organisme.nom },
      update: { siteWeb: organisme.siteWeb },
      create: organisme,
    });
  }
  console.log(`${organismes.length} organismes seedés.`);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD_SEED;

  if (!adminEmail || !adminPassword) {
    console.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD_SEED absents du .env — aucun compte admin créé."
    );
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });
  console.log(`Compte admin prêt pour ${adminEmail}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
