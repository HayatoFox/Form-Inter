-- CreateTable
CREATE TABLE "Reglage" (
    "cle" TEXT NOT NULL PRIMARY KEY,
    "valeur" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "declencheur" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "demarreLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termineLe" DATETIME,
    "dureeMs" INTEGER,
    "lignesRecues" INTEGER NOT NULL DEFAULT 0,
    "organismesCrees" INTEGER NOT NULL DEFAULT 0,
    "centresCrees" INTEGER NOT NULL DEFAULT 0,
    "domainesCrees" INTEGER NOT NULL DEFAULT 0,
    "formationsCreees" INTEGER NOT NULL DEFAULT 0,
    "sessionsCreees" INTEGER NOT NULL DEFAULT 0,
    "sessionsMajs" INTEGER NOT NULL DEFAULT 0,
    "sessionsRetirees" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Centre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "codePostal" TEXT,
    "adresse" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUEL',
    "organismeId" TEXT NOT NULL,
    CONSTRAINT "Centre_organismeId_fkey" FOREIGN KEY ("organismeId") REFERENCES "Organisme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Centre" ("adresse", "codePostal", "id", "nom", "organismeId", "ville") SELECT "adresse", "codePostal", "id", "nom", "organismeId", "ville" FROM "Centre";
DROP TABLE "Centre";
ALTER TABLE "new_Centre" RENAME TO "Centre";
CREATE INDEX "Centre_ville_idx" ON "Centre"("ville");
CREATE INDEX "Centre_organismeId_idx" ON "Centre"("organismeId");
CREATE UNIQUE INDEX "Centre_organismeId_nom_key" ON "Centre"("organismeId", "nom");
CREATE TABLE "new_Domaine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUEL'
);
INSERT INTO "new_Domaine" ("id", "nom") SELECT "id", "nom" FROM "Domaine";
DROP TABLE "Domaine";
ALTER TABLE "new_Domaine" RENAME TO "Domaine";
CREATE UNIQUE INDEX "Domaine_nom_key" ON "Domaine"("nom");
CREATE TABLE "new_Formation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "dureeValeur" REAL,
    "dureeUnite" TEXT,
    "typeFormation" TEXT,
    "urlProgramme" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUEL',
    "organismeId" TEXT NOT NULL,
    "domaineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Formation_organismeId_fkey" FOREIGN KEY ("organismeId") REFERENCES "Organisme" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Formation_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Formation" ("createdAt", "description", "domaineId", "dureeUnite", "dureeValeur", "id", "intitule", "organismeId", "updatedAt") SELECT "createdAt", "description", "domaineId", "dureeUnite", "dureeValeur", "id", "intitule", "organismeId", "updatedAt" FROM "Formation";
DROP TABLE "Formation";
ALTER TABLE "new_Formation" RENAME TO "Formation";
CREATE INDEX "Formation_organismeId_idx" ON "Formation"("organismeId");
CREATE INDEX "Formation_domaineId_idx" ON "Formation"("domaineId");
CREATE UNIQUE INDEX "Formation_organismeId_intitule_key" ON "Formation"("organismeId", "intitule");
CREATE TABLE "new_Organisme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "siteWeb" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUEL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Organisme" ("createdAt", "email", "id", "nom", "notes", "siteWeb", "telephone", "updatedAt") SELECT "createdAt", "email", "id", "nom", "notes", "siteWeb", "telephone", "updatedAt" FROM "Organisme";
DROP TABLE "Organisme";
ALTER TABLE "new_Organisme" RENAME TO "Organisme";
CREATE UNIQUE INDEX "Organisme_nom_key" ON "Organisme"("nom");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formationId" TEXT NOT NULL,
    "centreId" TEXT,
    "dateDebut" DATETIME,
    "dateFin" DATETIME,
    "permanente" BOOLEAN NOT NULL DEFAULT false,
    "dureeJours" REAL,
    "tarif" TEXT,
    "remarque" TEXT,
    "placesInfo" TEXT,
    "urlProgramme" TEXT,
    "sourceUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUEL',
    "sourceRef" TEXT,
    "firstSeen" DATETIME,
    "lastSeen" DATETIME,
    "syncedAt" DATETIME,
    CONSTRAINT "Session_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("centreId", "dateDebut", "dateFin", "formationId", "id", "placesInfo") SELECT "centreId", "dateDebut", "dateFin", "formationId", "id", "placesInfo" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_sourceRef_key" ON "Session"("sourceRef");
CREATE INDEX "Session_formationId_idx" ON "Session"("formationId");
CREATE INDEX "Session_centreId_idx" ON "Session"("centreId");
CREATE INDEX "Session_dateDebut_idx" ON "Session"("dateDebut");
CREATE INDEX "Session_source_idx" ON "Session"("source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SyncRun_demarreLe_idx" ON "SyncRun"("demarreLe");
