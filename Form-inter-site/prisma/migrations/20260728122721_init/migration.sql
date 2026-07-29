-- CreateTable
CREATE TABLE "Organisme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "siteWeb" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Centre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "codePostal" TEXT,
    "adresse" TEXT,
    "organismeId" TEXT NOT NULL,
    CONSTRAINT "Centre_organismeId_fkey" FOREIGN KEY ("organismeId") REFERENCES "Organisme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Domaine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "dureeValeur" REAL,
    "dureeUnite" TEXT,
    "organismeId" TEXT NOT NULL,
    "domaineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Formation_organismeId_fkey" FOREIGN KEY ("organismeId") REFERENCES "Organisme" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Formation_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formationId" TEXT NOT NULL,
    "centreId" TEXT,
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME,
    "placesInfo" TEXT,
    CONSTRAINT "Session_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisme_nom_key" ON "Organisme"("nom");

-- CreateIndex
CREATE INDEX "Centre_ville_idx" ON "Centre"("ville");

-- CreateIndex
CREATE INDEX "Centre_organismeId_idx" ON "Centre"("organismeId");

-- CreateIndex
CREATE UNIQUE INDEX "Centre_organismeId_nom_key" ON "Centre"("organismeId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "Domaine_nom_key" ON "Domaine"("nom");

-- CreateIndex
CREATE INDEX "Formation_organismeId_idx" ON "Formation"("organismeId");

-- CreateIndex
CREATE INDEX "Formation_domaineId_idx" ON "Formation"("domaineId");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_organismeId_intitule_key" ON "Formation"("organismeId", "intitule");

-- CreateIndex
CREATE INDEX "Session_formationId_idx" ON "Session"("formationId");

-- CreateIndex
CREATE INDEX "Session_centreId_idx" ON "Session"("centreId");

-- CreateIndex
CREATE INDEX "Session_dateDebut_idx" ON "Session"("dateDebut");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
