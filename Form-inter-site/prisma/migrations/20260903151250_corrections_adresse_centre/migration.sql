-- CreateTable
CREATE TABLE "ModificationCentre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centreId" TEXT NOT NULL,
    "quand" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteur" TEXT NOT NULL,
    "adresseAvant" TEXT,
    "codePostalAvant" TEXT,
    "villeAvant" TEXT NOT NULL,
    "latitudeAvant" REAL,
    "longitudeAvant" REAL,
    "adresseApres" TEXT,
    "codePostalApres" TEXT,
    "villeApres" TEXT NOT NULL,
    CONSTRAINT "ModificationCentre_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ModificationCentre_quand_idx" ON "ModificationCentre"("quand");

-- CreateIndex
CREATE INDEX "ModificationCentre_centreId_idx" ON "ModificationCentre"("centreId");
