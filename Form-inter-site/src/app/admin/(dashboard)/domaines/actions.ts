"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { domaineSchema } from "@/lib/validation";

function revalidateDomainePaths() {
  revalidatePath("/admin/domaines");
  revalidatePath("/admin/formations");
  revalidatePath("/formations");
}

// Fusionne les domaines `sourceIds` sous le nom `finalName` : toutes les
// formations rattachées basculent vers un domaine conservé, les autres sont
// supprimés. Si `finalName` correspond à un domaine existant hors de
// `sourceIds`, la fusion se fait dans ce domaine-là plutôt que d'échouer sur
// la contrainte d'unicité du nom.
async function mergeDomainesInto(finalName: string, sourceIds: string[]) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.domaine.findUnique({ where: { nom: finalName } });

    let keepId: string;
    if (existing) {
      keepId = existing.id;
    } else {
      keepId = sourceIds[0];
      await tx.domaine.update({
        where: { id: keepId },
        data: { nom: finalName },
      });
    }

    const toDelete = sourceIds.filter((id) => id !== keepId);
    if (toDelete.length > 0) {
      await tx.formation.updateMany({
        where: { domaineId: { in: toDelete } },
        data: { domaineId: keepId },
      });
      await tx.domaine.deleteMany({ where: { id: { in: toDelete } } });
    }
  });
}

export async function createDomaine(formData: FormData) {
  const data = domaineSchema.parse(Object.fromEntries(formData.entries()));
  await prisma.domaine.create({ data });
  revalidateDomainePaths();
}

// Un renommage vers un nom déjà pris par un autre domaine se comporte comme
// une fusion dans ce domaine, plutôt que d'échouer sur la contrainte d'unicité.
export async function renameDomaine(id: string, formData: FormData) {
  const data = domaineSchema.parse(Object.fromEntries(formData.entries()));
  await mergeDomainesInto(data.nom, [id]);
  revalidateDomainePaths();
}

export async function deleteDomaine(id: string) {
  await prisma.domaine.delete({ where: { id } });
  revalidateDomainePaths();
}

// Fusionne le domaine `anchorId` avec les domaines cochés dans `mergeWith`
// sous un nom final unique.
export async function mergeDomaines(anchorId: string, formData: FormData) {
  const finalName = String(formData.get("finalName") ?? "").trim();
  const mergeWith = formData.getAll("mergeWith").map(String);

  if (!finalName) {
    throw new Error("Le nom final du domaine est requis");
  }

  const mergeIds = Array.from(new Set([anchorId, ...mergeWith]));
  await mergeDomainesInto(finalName, mergeIds);
  revalidateDomainePaths();
}
