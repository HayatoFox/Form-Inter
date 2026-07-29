"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formationSchema, sessionSchema } from "@/lib/validation";

function toEntries(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createFormation(formData: FormData) {
  const data = formationSchema.parse(toEntries(formData));
  const formation = await prisma.formation.create({
    data: {
      intitule: data.intitule,
      description: data.description || null,
      dureeValeur: data.dureeValeur ?? null,
      dureeUnite: data.dureeUnite || null,
      organismeId: data.organismeId,
      domaineId: data.domaineId || null,
    },
  });
  revalidatePath("/admin/formations");
  revalidatePath("/formations");
  redirect(`/admin/formations/${formation.id}`);
}

export async function updateFormation(id: string, formData: FormData) {
  const data = formationSchema.parse(toEntries(formData));
  await prisma.formation.update({
    where: { id },
    data: {
      intitule: data.intitule,
      description: data.description || null,
      dureeValeur: data.dureeValeur ?? null,
      dureeUnite: data.dureeUnite || null,
      organismeId: data.organismeId,
      domaineId: data.domaineId || null,
    },
  });
  revalidatePath("/admin/formations");
  revalidatePath(`/admin/formations/${id}`);
  revalidatePath("/formations");
  revalidatePath(`/formations/${id}`);
}

export async function deleteFormation(id: string) {
  await prisma.formation.delete({ where: { id } });
  revalidatePath("/admin/formations");
  revalidatePath("/formations");
  redirect("/admin/formations");
}

export async function createSession(formationId: string, formData: FormData) {
  const raw = toEntries(formData);
  const data = sessionSchema.parse({ ...raw, formationId });
  await prisma.session.create({
    data: {
      formationId: data.formationId,
      centreId: data.centreId || null,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin ?? null,
      placesInfo: data.placesInfo || null,
    },
  });
  revalidatePath(`/admin/formations/${formationId}`);
  revalidatePath(`/formations/${formationId}`);
  revalidatePath("/formations");
}

export async function deleteSession(formationId: string, sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } });
  revalidatePath(`/admin/formations/${formationId}`);
  revalidatePath(`/formations/${formationId}`);
  revalidatePath("/formations");
}
