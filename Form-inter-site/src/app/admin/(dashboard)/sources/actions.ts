"use server";

import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ecrireConfigBackend,
  lireConfigBackend,
  type ModeBackend,
} from "@/lib/backend/config";
import { creerConnecteur } from "@/lib/backend/connecteurs";
import { synchroniser } from "@/lib/backend/sync";
import { BACKEND, type ResultatSync } from "@/lib/backend/types";
import { revaliderCatalogue } from "@/lib/revalidation";
import type { EtatAction } from "./etat";

function texte(formData: FormData, nom: string): string {
  return String(formData.get(nom) ?? "").trim();
}

function coche(formData: FormData, nom: string): boolean {
  return formData.get(nom) !== null;
}

function mode(formData: FormData): ModeBackend {
  const valeur = texte(formData, "mode");
  return valeur === "http" || valeur === "sqlite" ? valeur : "off";
}

function messageErreur(err: unknown): string {
  return err instanceof Error ? err.message : "Erreur inconnue";
}

export async function enregistrerLiaison(
  _precedent: EtatAction,
  formData: FormData
): Promise<EtatAction> {
  await exigerAdmin();

  const choisi = mode(formData);
  const url = texte(formData, "url");
  const dbPath = texte(formData, "dbPath");

  if (choisi === "http" && !url) {
    return { statut: "erreur", message: "L'adresse de l'API est requise." };
  }
  if (choisi === "http" && !/^https?:\/\//i.test(url)) {
    return {
      statut: "erreur",
      message: "L'adresse doit commencer par http:// ou https://",
    };
  }
  if (choisi === "sqlite" && !dbPath) {
    return {
      statut: "erreur",
      message: "Le chemin du fichier formations.db est requis.",
    };
  }

  const ttl = Number(texte(formData, "ttlMinutes"));

  await ecrireConfigBackend({
    mode: choisi,
    url,
    dbPath,
    // Champ laissé vide = jeton inchangé ; la case « effacer » le supprime.
    token: coche(formData, "effacerToken") ? null : texte(formData, "token") || undefined,
    autoSync: coche(formData, "autoSync"),
    ttlMinutes: Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 60,
    inclurePassees: coche(formData, "inclurePassees"),
  });

  revalidatePath("/admin/sources");
  return { statut: "ok", message: "Configuration enregistrée." };
}

export async function testerLiaison(
  _precedent: EtatAction,
  formData: FormData
): Promise<EtatAction> {
  await exigerAdmin();

  const enregistree = await lireConfigBackend();
  const choisi = mode(formData);

  if (choisi === "off") {
    return {
      statut: "erreur",
      message: "Choisissez un mode de liaison avant de tester.",
    };
  }

  // Le test porte sur les valeurs affichées dans le formulaire, pas sur celles
  // déjà enregistrées : on peut vérifier une adresse avant de la valider.
  const config = {
    ...enregistree,
    mode: choisi,
    url: texte(formData, "url") || enregistree.url,
    dbPath: texte(formData, "dbPath") || enregistree.dbPath,
    token: texte(formData, "token") || enregistree.token,
  };

  try {
    const sante = await creerConnecteur(config).tester();
    const details = [
      sante.service,
      sante.sessions !== undefined ? `${sante.sessions} sessions` : null,
      sante.organismes !== undefined ? `${sante.organismes} organismes` : null,
      sante.dernier_scrape ? `dernier scrape ${sante.dernier_scrape}` : null,
    ].filter(Boolean);
    return {
      statut: "ok",
      message: "Liaison opérationnelle.",
      detail: details.join(" · "),
    };
  } catch (err) {
    return { statut: "erreur", message: messageErreur(err) };
  }
}

export async function lancerSynchronisation(): Promise<ResultatSync> {
  await exigerAdmin();
  const resultat = await synchroniser("manuel");
  if (resultat.statut === "ok") revaliderCatalogue();
  revalidatePath("/admin/sources");
  return resultat;
}

// Retire du site tout ce qui provient du backend, sans toucher aux données
// saisies ou importées à la main. Utile pour repartir d'une liaison propre :
// la synchronisation suivante reconstruit tout depuis le backend.
export async function purgerDonneesBackend(): Promise<EtatAction> {
  await exigerAdmin();

  const sessions = await prisma.session.deleteMany({ where: { source: BACKEND } });
  const formations = await prisma.formation.deleteMany({
    where: { source: BACKEND, sessions: { none: {} } },
  });
  const centres = await prisma.centre.deleteMany({
    where: { source: BACKEND, sessions: { none: {} } },
  });
  const domaines = await prisma.domaine.deleteMany({
    where: { source: BACKEND, formations: { none: {} } },
  });
  const organismes = await prisma.organisme.deleteMany({
    where: { source: BACKEND, formations: { none: {} }, centres: { none: {} } },
  });

  revaliderCatalogue();
  revalidatePath("/admin/sources");

  return {
    statut: "ok",
    message: "Données du backend retirées.",
    detail:
      `${sessions.count} session(s), ${formations.count} formation(s), ` +
      `${centres.count} centre(s), ${domaines.count} domaine(s), ` +
      `${organismes.count} organisme(s)`,
  };
}
