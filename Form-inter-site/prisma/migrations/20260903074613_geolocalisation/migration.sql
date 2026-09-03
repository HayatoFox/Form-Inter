-- CreateTable
CREATE TABLE "Geocodage" (
    "requete" TEXT NOT NULL PRIMARY KEY,
    "trouve" BOOLEAN NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "libelle" TEXT,
    "genre" TEXT,
    "source" TEXT NOT NULL DEFAULT 'nominatim',
    "creeLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utiliseLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "latitude" REAL,
    "longitude" REAL,
    "geoStatut" TEXT NOT NULL DEFAULT 'attente',
    "geoRequete" TEXT,
    "geoLibelle" TEXT,
    "geoLe" DATETIME,
    "organismeId" TEXT NOT NULL,
    CONSTRAINT "Centre_organismeId_fkey" FOREIGN KEY ("organismeId") REFERENCES "Organisme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Centre" ("adresse", "codePostal", "id", "nom", "organismeId", "source", "ville") SELECT "adresse", "codePostal", "id", "nom", "organismeId", "source", "ville" FROM "Centre";
DROP TABLE "Centre";
ALTER TABLE "new_Centre" RENAME TO "Centre";
CREATE INDEX "Centre_ville_idx" ON "Centre"("ville");
CREATE INDEX "Centre_organismeId_idx" ON "Centre"("organismeId");
CREATE INDEX "Centre_geoStatut_idx" ON "Centre"("geoStatut");
CREATE UNIQUE INDEX "Centre_organismeId_nom_key" ON "Centre"("organismeId", "nom");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Geocodage_utiliseLe_idx" ON "Geocodage"("utiliseLe");
