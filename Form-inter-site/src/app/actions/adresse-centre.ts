"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Corriger l'adresse d'un centre — SANS COMPTE.
 *
 * C'est un outil interne : celui qui s'aperçoit au téléphone que le centre de
 * Rennes est en réalité à Cesson-Sévigné doit pouvoir le réparer sur-le-champ,
 * pas demander un accès au back office. L'écriture est donc ouverte à tout le
 * monde, et c'est un choix assumé, pas un oubli.
 *
 * Trois contreparties, parce qu'une écriture anonyme sans filet n'est pas
 * tenable :
 *
 * 1. **Seule une adresse CHOISIE dans les suggestions est acceptée.** Le
 *    service d'adresses en rend les coordonnées ; exiger qu'elles soient
 *    présentes garantit que l'adresse existe et qu'elle est située. Du texte
 *    libre serait invérifiable — et c'est exactement ce qu'on ne veut pas
 *    laisser écrire sans compte.
 * 2. **Tout est journalisé avec les valeurs d'avant** (`ModificationCentre`),
 *    donc une erreur se voit et se rétablit d'un clic au back office.
 * 3. **Un plafond par adresse IP**, pour qu'un script maladroit ne réécrive pas
 *    le catalogue en boucle.
 *
 * Ce que la correction ne touche pas : le NOM du centre. La synchronisation le
 * retrouve par lui, et le changer ferait naître un doublon au passage suivant.
 */

const schema = z.object({
  centreId: z.string().min(1),
  // Facultative : une suggestion de commune n'a pas de rue.
  adresse: z.string().trim().max(200).optional(),
  codePostal: z.string().trim().max(20).optional(),
  ville: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  libelle: z.string().trim().max(300),
});

export type EntreeCorrection = z.input<typeof schema>;
export type ResultatCorrection = { ok: true } | { ok: false; erreur: string };

// Vingt corrections par heure et par adresse IP : très au-delà d'un usage
// humain, très en-dessous de ce qu'une boucle produirait.
const PLAFOND = 20;
const FENETRE_MS = 60 * 60_000;
const passages = new Map<string, number[]>();

function trop(ip: string): boolean {
  const maintenant = Date.now();
  const recents = (passages.get(ip) ?? []).filter(
    (t) => maintenant - t < FENETRE_MS
  );
  recents.push(maintenant);
  passages.set(ip, recents);
  // La table ne doit pas grossir indéfiniment sur un serveur qui tourne des
  // mois : on oublie les adresses dont tous les passages sont périmés.
  if (passages.size > 5000) {
    for (const [cle, dates] of passages) {
      if (dates.every((t) => maintenant - t >= FENETRE_MS)) passages.delete(cle);
    }
  }
  return recents.length > PLAFOND;
}

export async function corrigerAdresseCentre(
  entree: EntreeCorrection
): Promise<ResultatCorrection> {
  const analyse = schema.safeParse(entree);
  if (!analyse.success) {
    return { ok: false, erreur: "Adresse incomplète : choisissez-la dans la liste." };
  }
  const data = analyse.data;

  const entetes = await headers();
  const ip =
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    entetes.get("x-real-ip") ||
    "inconnue";
  if (trop(ip)) {
    return {
      ok: false,
      erreur: "Trop de corrections d'affilée. Réessayez dans une heure.",
    };
  }

  const avant = await prisma.centre.findUnique({
    where: { id: data.centreId },
    select: {
      adresse: true,
      codePostal: true,
      ville: true,
      latitude: true,
      longitude: true,
      organismeId: true,
    },
  });
  if (!avant) return { ok: false, erreur: "Ce centre n'existe plus." };

  const admin = await getCurrentAdmin();

  await prisma.$transaction([
    prisma.centre.update({
      where: { id: data.centreId },
      data: {
        adresse: data.adresse || null,
        codePostal: data.codePostal || null,
        ville: data.ville,
        latitude: data.latitude,
        longitude: data.longitude,
        // L'adresse vient du service, coordonnées comprises : rien à géocoder.
        geoStatut: "ok",
        geoLibelle: data.libelle || null,
        geoRequete: null,
        geoLe: new Date(),
      },
    }),
    prisma.modificationCentre.create({
      data: {
        centreId: data.centreId,
        auteur: admin?.email ?? "public",
        adresseAvant: avant.adresse,
        codePostalAvant: avant.codePostal,
        villeAvant: avant.ville,
        latitudeAvant: avant.latitude,
        longitudeAvant: avant.longitude,
        adresseApres: data.adresse || null,
        codePostalApres: data.codePostal || null,
        villeApres: data.ville,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/formations");
  revalidatePath("/organismes");
  revalidatePath(`/organismes/${avant.organismeId}`);
  revalidatePath("/admin/centres");
  return { ok: true };
}
