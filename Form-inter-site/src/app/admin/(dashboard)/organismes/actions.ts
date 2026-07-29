"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

export async function createCentre(organismeId: string, formData: FormData) {
  const data = centreSchema.parse({ ...toEntries(formData), organismeId });
  await prisma.centre.create({
    data: {
      nom: data.nom,
      ville: data.ville,
      codePostal: data.codePostal || null,
      adresse: data.adresse || null,
      organismeId: data.organismeId,
    },
  });
  revalidatePath(`/admin/organismes/${organismeId}`);
  revalidatePath("/formations");
  revalidatePath("/organismes");
}

export async function deleteCentre(organismeId: string, centreId: string) {
  await prisma.centre.delete({ where: { id: centreId } });
  revalidatePath(`/admin/organismes/${organismeId}`);
  revalidatePath("/formations");
  revalidatePath("/organismes");
}
