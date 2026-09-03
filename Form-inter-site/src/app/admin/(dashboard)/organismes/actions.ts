"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigerAdmin } from "@/lib/auth";
import { centreSchema, organismeSchema } from "@/lib/validation";

function toEntries(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createOrganisme(formData: FormData) {
  const data = organismeSchema.parse(toEntries(formData));
  const organisme = await prisma.organisme.create({
    data: {
      nom: data.nom,
      siteWeb: data.siteWeb || null,
      telephone: data.telephone || null,
      email: data.email || null,
      notes: data.notes || null,
    },
  });
  revalidatePath("/admin/organismes");
  revalidatePath("/organismes");
  redirect(`/admin/organismes/${organisme.id}`);
}

export async function updateOrganisme(id: string, formData: FormData) {
  const data = organismeSchema.parse(toEntries(formData));
  await prisma.organisme.update({
    where: { id },
    data: {
      nom: data.nom,
      siteWeb: data.siteWeb || null,
      telephone: data.telephone || null,
      email: data.email || null,
      notes: data.notes || null,
    },
  });
  revalidatePath("/admin/organismes");
  revalidatePath(`/admin/organismes/${id}`);
  revalidatePath("/organismes");
  revalidatePath(`/organismes/${id}`);
}

export async function deleteOrganisme(id: string) {
  await prisma.organisme.delete({ where: { id } });
  revalidatePath("/admin/organismes");
  revalidatePath("/organismes");
  redirect("/admin/organismes");
}

/**
 * Position issue d'une adresse choisie dans les suggestions.
 *
 * Le service d'adresses rend les coordonnées avec chaque proposition : quand
 * l'adresse vient de là, il n'y a rien à géocoder et le centre est posé sur la
 * carte immédiatement, `geoStatut` à « ok ». Sans coordonnées, il part en file
 * d'attente comme avant.
 */
function positionChoisie(data: {
  latitude?: number;
  longitude?: number;
  geoLibelle?: string;
}) {
  if (data.latitude === undefined || data.longitude === undefined) return null;
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    geoStatut: "ok",
    geoLibelle: data.geoLibelle || null,
    geoRequete: null,
    geoLe: new Date(),
  };
}

export async function createCentre(organismeId: string, formData: FormData) {
  const data = centreSchema.parse({ ...toEntries(formData), organismeId });
  await prisma.centre.create({
    data: {
      nom: data.nom,
      ville: data.ville,
      codePostal: data.codePostal || null,
      adresse: data.adresse || null,
      organismeId: data.organismeId,
      ...(positionChoisie(data) ?? {}),
    },
  });
  revalidatePath(`/admin/organismes/${organismeId}`);
  revalidatePath("/admin/centres");
  revalidatePath("/formations");
  revalidatePath("/organismes");
  revalidatePath("/");
}

/**
 * Modifier un centre — et notamment lui donner son adresse de rue.
 *
 * Elle n'arrive par aucun autre chemin : les scrapers ne relèvent que la ville,
 * et jusqu'ici un centre n'était modifiable qu'à sa création. Autrement dit,
 * tous les centres rapatriés du backend étaient condamnés à rester au
 * centre-ville de leur commune, sur la carte comme dans une convocation.
 *
 * Quand l'adresse, le code postal ou la ville changent, le centre RETOURNE en
 * file de géocodage : ses coordonnées désignent l'ancienne adresse.
 *
 * Elles ne sont pour autant effacées que si la VILLE change. Une rue corrigée
 * dans la même commune laisse l'ancien point à quelques centaines de mètres :
 * c'est la meilleure réponse disponible en attendant l'affinage, et bien mieux
 * qu'un centre qui disparaît de la carte parce qu'on a pris la peine de
 * préciser son adresse.
 */
export async function updateCentre(
  organismeId: string,
  centreId: string,
  formData: FormData
) {
  const data = centreSchema.parse({ ...toEntries(formData), organismeId });
  const avant = await prisma.centre.findUnique({
    where: { id: centreId },
    select: { adresse: true, codePostal: true, ville: true },
  });

  const adresse = data.adresse || null;
  const codePostal = data.codePostal || null;
  const lieuChange =
    !avant ||
    avant.adresse !== adresse ||
    avant.codePostal !== codePostal ||
    avant.ville !== data.ville;
  const villeChange = !avant || avant.ville !== data.ville;
  const position = positionChoisie(data);

  await prisma.centre.update({
    where: { id: centreId },
    data: {
      nom: data.nom,
      ville: data.ville,
      codePostal,
      adresse,
      ...(position
        ? // L'adresse vient des suggestions : sa position est connue, le centre
          // apparaît sur la carte sans passer par la file d'attente.
          position
        : {
            ...(lieuChange && {
              geoStatut: "attente",
              geoRequete: null,
              geoLibelle: null,
              geoLe: null,
            }),
            // Changer de commune invalide vraiment le point ; corriger une rue
            // ne fait que le rendre approximatif.
            ...(villeChange && { latitude: null, longitude: null }),
          }),
    },
  });

  revalidatePath(`/admin/organismes/${organismeId}`);
  revalidatePath("/admin/centres");
  revalidatePath("/admin/sources");
  revalidatePath("/formations");
  revalidatePath("/organismes");
  revalidatePath("/");
}

/**
 * Rétablir l'adresse d'un centre telle qu'elle était avant une correction.
 *
 * C'est la contrepartie de l'ouverture des corrections à tout le monde : une
 * erreur ne se discute pas, elle s'annule. Les valeurs d'avant sont conservées
 * dans le journal, donc le rétablissement est une recopie — et il est
 * lui-même journalisé, pour qu'on ne perde pas la trace de l'aller-retour.
 */
export async function retablirAdresse(modificationId: string) {
  const admin = await exigerAdmin();
  const trace = await prisma.modificationCentre.findUnique({
    where: { id: modificationId },
    include: { centre: { select: { id: true, organismeId: true, adresse: true, codePostal: true, ville: true, latitude: true, longitude: true } } },
  });
  if (!trace) return;

  const actuel = trace.centre;
  await prisma.$transaction([
    prisma.centre.update({
      where: { id: actuel.id },
      data: {
        adresse: trace.adresseAvant,
        codePostal: trace.codePostalAvant,
        ville: trace.villeAvant,
        latitude: trace.latitudeAvant,
        longitude: trace.longitudeAvant,
        // Sans coordonnées d'avant, le centre repart en file de géocodage :
        // c'est exactement l'état où il était.
        geoStatut: trace.latitudeAvant === null ? "attente" : "ok",
        geoLibelle: null,
        geoRequete: null,
        geoLe: trace.latitudeAvant === null ? null : new Date(),
      },
    }),
    prisma.modificationCentre.create({
      data: {
        centreId: actuel.id,
        auteur: `${admin.email} (rétablissement)`,
        adresseAvant: actuel.adresse,
        codePostalAvant: actuel.codePostal,
        villeAvant: actuel.ville,
        latitudeAvant: actuel.latitude,
        longitudeAvant: actuel.longitude,
        adresseApres: trace.adresseAvant,
        codePostalApres: trace.codePostalAvant,
        villeApres: trace.villeAvant,
      },
    }),
  ]);

  revalidatePath("/admin/centres");
  revalidatePath(`/admin/organismes/${actuel.organismeId}`);
  revalidatePath("/formations");
  revalidatePath("/organismes");
  revalidatePath("/");
}

export async function deleteCentre(organismeId: string, centreId: string) {
  await prisma.centre.delete({ where: { id: centreId } });
  revalidatePath(`/admin/organismes/${organismeId}`);
  revalidatePath("/admin/centres");
  revalidatePath("/formations");
  revalidatePath("/organismes");
  revalidatePath("/");
}
