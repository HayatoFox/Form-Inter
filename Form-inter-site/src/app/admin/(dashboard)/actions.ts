"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// Supprime définitivement toutes les données métier (organismes, centres,
// domaines, formations, sessions). Le compte admin n'est pas touché.
export async function wipeAllData() {
  await prisma.organisme.deleteMany({}); // cascade -> centres, formations, sessions
  await prisma.domaine.deleteMany({});

  revalidatePath("/admin");
  revalidatePath("/admin/organismes");
  revalidatePath("/admin/domaines");
  revalidatePath("/admin/formations");
  revalidatePath("/formations");
  revalidatePath("/organismes");
}
