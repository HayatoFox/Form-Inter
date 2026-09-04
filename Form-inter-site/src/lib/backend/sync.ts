import "server-only";
import { prisma } from "@/lib/prisma";
import { CLES, lireConfigBackend } from "@/lib/backend/config";
import {
  CollecteEnCours,
  creerConnecteur,
  ErreurBackend,
} from "@/lib/backend/connecteurs";
import {
  BACKEND,
  cleNormalisee,
  refSession,
  type CompteRendu,
  type LigneBackend,
  type ResultatSync,
} from "@/lib/backend/types";
import { parseDateISO } from "@/lib/dates";

// Moteur de synchronisation site <- backend de veille.
//
// Principes :
// - idempotent : deux passages consécutifs sans nouveau scrape côté backend ne
//   produisent aucune écriture ;
// - non destructif pour la saisie manuelle : rien de ce qui porte
//   source = "MANUEL" n'est modifié ni supprimé, y compris les organismes,
//   domaines et centres réutilisés par les lignes du backend ;
// - garde-fou : un catalogue vide interrompt le passage plutôt que de vider le
//   site (backend en panne, jeton révoqué, mauvais chemin de base) ;
// - miroir : une session du backend absente du lot reçu est retirée du site.
//   C'est sans danger parce que le backend définit son « offre courante » par
//   organisme (last_seen = MAX(last_seen) de CET organisme) : un scraper en
//   échec un matin continue de publier ce qu'il avait relevé la veille, son
//   organisme ne disparaît donc jamais du lot. Et un lot tronqué ne peut pas
//   être confondu avec un lot complet : le connecteur lève une erreur plutôt
//   que de renvoyer une pagination incomplète.

const LOT = 500;
const VERROU_MS = 15 * 60 * 1000;

const VIDE: CompteRendu = {
  lignesRecues: 0,
  organismesCrees: 0,
  centresCrees: 0,
  domainesCrees: 0,
  formationsCreees: 0,
  sessionsCreees: 0,
  sessionsMajs: 0,
  sessionsRetirees: 0,
};

function lots<T>(elements: T[], taille = LOT): T[][] {
  const morceaux: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) {
    morceaux.push(elements.slice(i, i + taille));
  }
  return morceaux;
}

function memeInstant(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

// --- Verrou -----------------------------------------------------------------

// Un seul passage à la fois : la synchronisation automatique se déclenche au
// chargement des pages, plusieurs visiteurs simultanés la lanceraient sinon en
// parallèle. Le verrou porte sa propre expiration pour ne pas rester coincé si
// le processus meurt en cours de route.
async function prendreVerrou(): Promise<boolean> {
  const maintenant = new Date().toISOString();
  const expiration = new Date(Date.now() + VERROU_MS).toISOString();
  try {
    await prisma.reglage.create({
      data: { cle: CLES.verrou, valeur: expiration },
    });
    return true;
  } catch {
    const { count } = await prisma.reglage.updateMany({
      where: { cle: CLES.verrou, valeur: { lt: maintenant } },
      data: { valeur: expiration },
    });
    return count === 1;
  }
}

async function rendreVerrou(): Promise<void> {
  await prisma.reglage.deleteMany({ where: { cle: CLES.verrou } });
}

// --- Application d'un lot de lignes -----------------------------------------

type FormationVoulue = {
  organismeId: string;
  intitule: string;
  typeFormation: string | null;
  urlProgramme: string | null;
  domaineId: string | null;
  dureeJours: number | null;
};

type SessionVoulue = {
  sourceRef: string;
  formationId: string;
  centreId: string | null;
  dateDebut: Date | null;
  dateFin: Date | null;
  permanente: boolean;
  dureeJours: number | null;
  tarif: string | null;
  remarque: string | null;
  placesInfo: string | null;
  urlProgramme: string | null;
  sourceUrl: string | null;
  firstSeen: Date | null;
  lastSeen: Date | null;
};

async function appliquerLignes(lignes: LigneBackend[]): Promise<CompteRendu> {
  const compte: CompteRendu = { ...VIDE, lignesRecues: lignes.length };
  const maintenant = new Date();

  // --- Organismes
  const organismes = await prisma.organisme.findMany({
    select: { id: true, nom: true },
  });
  const orgParCle = new Map(organismes.map((o) => [cleNormalisee(o.nom), o.id]));

  for (const ligne of lignes) {
    const cle = cleNormalisee(ligne.organisme);
    if (orgParCle.has(cle)) continue;
    const cree = await prisma.organisme.create({
      data: { nom: ligne.organisme, source: BACKEND },
      select: { id: true },
    });
    orgParCle.set(cle, cree.id);
    compte.organismesCrees += 1;
  }

  // --- Domaines (classification commune calculée par le backend)
  const domaines = await prisma.domaine.findMany({
    select: { id: true, nom: true },
  });
  const domParCle = new Map(domaines.map((d) => [cleNormalisee(d.nom), d.id]));

  for (const ligne of lignes) {
    if (!ligne.domaine) continue;
    const cle = cleNormalisee(ligne.domaine);
    if (domParCle.has(cle)) continue;
    const cree = await prisma.domaine.create({
      data: { nom: ligne.domaine, source: BACKEND },
      select: { id: true },
    });
    domParCle.set(cle, cree.id);
    compte.domainesCrees += 1;
  }

  // --- Centres : le backend ne connaît que la ville, elle sert de nom
  const centres = await prisma.centre.findMany({
    select: { id: true, nom: true, organismeId: true },
  });
  const centreParCle = new Map(
    centres.map((c) => [`${c.organismeId}|${cleNormalisee(c.nom)}`, c.id])
  );

  for (const ligne of lignes) {
    if (!ligne.ville) continue;
    const organismeId = orgParCle.get(cleNormalisee(ligne.organisme))!;
    const cle = `${organismeId}|${cleNormalisee(ligne.ville)}`;
    if (centreParCle.has(cle)) continue;
    const cree = await prisma.centre.create({
      data: {
        nom: ligne.ville,
        ville: ligne.ville,
        organismeId,
        source: BACKEND,
      },
      select: { id: true },
    });
    centreParCle.set(cle, cree.id);
    compte.centresCrees += 1;
  }

  // --- Formations : une par (organisme, intitulé). Les attributs retenus sont
  // les premiers non vides rencontrés dans le lot.
  const voulues = new Map<string, FormationVoulue>();
  for (const ligne of lignes) {
    const organismeId = orgParCle.get(cleNormalisee(ligne.organisme))!;
    const cle = `${organismeId}|${cleNormalisee(ligne.formation)}`;
    const deja = voulues.get(cle);
    const domaineId = ligne.domaine
      ? (domParCle.get(cleNormalisee(ligne.domaine)) ?? null)
      : null;
    if (!deja) {
      voulues.set(cle, {
        organismeId,
        intitule: ligne.formation,
        typeFormation: ligne.type_formation,
        urlProgramme: ligne.url_programme,
        domaineId,
        dureeJours: ligne.duree_jours,
      });
      continue;
    }
    deja.typeFormation ??= ligne.type_formation;
    deja.urlProgramme ??= ligne.url_programme;
    deja.domaineId ??= domaineId;
    deja.dureeJours ??= ligne.duree_jours;
  }

  const formations = await prisma.formation.findMany({
    select: {
      id: true,
      intitule: true,
      organismeId: true,
      source: true,
      domaineId: true,
      typeFormation: true,
      urlProgramme: true,
      dureeValeur: true,
      dureeUnite: true,
    },
  });
  const formParCle = new Map(
    formations.map((f) => [`${f.organismeId}|${cleNormalisee(f.intitule)}`, f])
  );

  for (const [cle, voulue] of voulues) {
    const existante = formParCle.get(cle);
    if (!existante) {
      const creee = await prisma.formation.create({
        data: {
          intitule: voulue.intitule,
          organismeId: voulue.organismeId,
          domaineId: voulue.domaineId,
          typeFormation: voulue.typeFormation,
          urlProgramme: voulue.urlProgramme,
          dureeValeur: voulue.dureeJours,
          dureeUnite: voulue.dureeJours === null ? null : "jours",
          source: BACKEND,
        },
        select: {
          id: true,
          intitule: true,
          organismeId: true,
          source: true,
          domaineId: true,
          typeFormation: true,
          urlProgramme: true,
          dureeValeur: true,
          dureeUnite: true,
        },
      });
      formParCle.set(cle, creee);
      compte.formationsCreees += 1;
      continue;
    }

    // Une formation saisie à la main garde ses valeurs ; une formation issue du
    // backend suit la source. Dans les deux cas on ne fait que compléter les
    // champs restés vides.
    const maj: Record<string, unknown> = {};
    if (existante.source === BACKEND) {
      if (existante.domaineId !== voulue.domaineId && voulue.domaineId) {
        maj.domaineId = voulue.domaineId;
      }
      if (existante.typeFormation !== voulue.typeFormation) {
        maj.typeFormation = voulue.typeFormation;
      }
      if (existante.urlProgramme !== voulue.urlProgramme) {
        maj.urlProgramme = voulue.urlProgramme;
      }
    }
    if (existante.dureeValeur === null && voulue.dureeJours !== null) {
      maj.dureeValeur = voulue.dureeJours;
      maj.dureeUnite = existante.dureeUnite ?? "jours";
    }
    if (Object.keys(maj).length > 0) {
      await prisma.formation.update({ where: { id: existante.id }, data: maj });
    }
  }

  // --- Sessions
  const sessionsVoulues = new Map<string, SessionVoulue>();

  for (const ligne of lignes) {
    const organismeId = orgParCle.get(cleNormalisee(ligne.organisme))!;
    const formation = formParCle.get(
      `${organismeId}|${cleNormalisee(ligne.formation)}`
    )!;
    const centreId = ligne.ville
      ? (centreParCle.get(`${organismeId}|${cleNormalisee(ligne.ville)}`) ?? null)
      : null;
    const dateDebut = parseDateISO(ligne.date_debut);
    const dateFin = parseDateISO(ligne.date_fin);

    sessionsVoulues.set(refSession(ligne), {
      sourceRef: refSession(ligne),
      formationId: formation.id,
      centreId,
      dateDebut,
      dateFin,
      // Dates nulles côté backend = offre ouverte en continu (entrée/sortie
      // permanente), pas une date manquante.
      permanente: dateDebut === null,
      dureeJours: ligne.duree_jours,
      tarif: ligne.tarif,
      remarque: ligne.remarque,
      placesInfo: ligne.disponibilite,
      urlProgramme: ligne.url_programme,
      sourceUrl: ligne.source_url,
      firstSeen: parseDateISO(ligne.first_seen),
      lastSeen: parseDateISO(ligne.last_seen),
    });
  }

  const existantes = await prisma.session.findMany({
    where: { source: BACKEND, sourceRef: { not: null } },
    select: {
      id: true,
      sourceRef: true,
      dureeJours: true,
      tarif: true,
      remarque: true,
      placesInfo: true,
      urlProgramme: true,
      sourceUrl: true,
      firstSeen: true,
      lastSeen: true,
    },
  });
  const existantesParRef = new Map(existantes.map((s) => [s.sourceRef!, s]));

  const aCreer: SessionVoulue[] = [];
  const aMettreAJour: { id: string; voulue: SessionVoulue }[] = [];

  for (const [ref, voulue] of sessionsVoulues) {
    const existante = existantesParRef.get(ref);
    if (!existante) {
      aCreer.push(voulue);
      continue;
    }
    const identique =
      existante.dureeJours === voulue.dureeJours &&
      existante.tarif === voulue.tarif &&
      existante.remarque === voulue.remarque &&
      existante.placesInfo === voulue.placesInfo &&
      existante.urlProgramme === voulue.urlProgramme &&
      existante.sourceUrl === voulue.sourceUrl &&
      memeInstant(existante.firstSeen, voulue.firstSeen) &&
      memeInstant(existante.lastSeen, voulue.lastSeen);
    if (!identique) aMettreAJour.push({ id: existante.id, voulue });
  }

  // Retrait des sessions que le backend ne publie plus — y compris quand c'est
  // tout un organisme qui n'a plus rien de courant à proposer.
  const aSupprimer = existantes
    .filter((s) => !sessionsVoulues.has(s.sourceRef!))
    .map((s) => s.id);

  for (const lot of lots(aCreer)) {
    await prisma.session.createMany({
      data: lot.map((s) => ({
        formationId: s.formationId,
        centreId: s.centreId,
        dateDebut: s.dateDebut,
        dateFin: s.dateFin,
        permanente: s.permanente,
        dureeJours: s.dureeJours,
        tarif: s.tarif,
        remarque: s.remarque,
        placesInfo: s.placesInfo,
        urlProgramme: s.urlProgramme,
        sourceUrl: s.sourceUrl,
        source: BACKEND,
        sourceRef: s.sourceRef,
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
        syncedAt: maintenant,
      })),
    });
  }
  compte.sessionsCreees = aCreer.length;

  // Une mise à jour par session, et c'est volontaire. Chaque passage du
  // scraper change la date de dernière vue de TOUTES les sessions : le lot
  // fait facilement trois mille lignes. On a donc mesuré, sur les 2976
  // sessions du jeu réel :
  //
  //   avant, journal SQLite en mode « delete »  : 3933 ms
  //   en WAL, une par une (ci-dessous)          :  625 ms
  //   en WAL, groupées par 500 en transaction   :  663 ms
  //
  // Le groupement n'apporte RIEN une fois la base en WAL — Prisma envoie de
  // toute façon une instruction par ligne — et il coûtait du code en plus. Le
  // gain était ailleurs, dans les réglages SQLite (src/lib/sqlite-reglages.ts).
  for (const { id, voulue } of aMettreAJour) {
    await prisma.session.update({
      where: { id },
      data: {
        dureeJours: voulue.dureeJours,
        tarif: voulue.tarif,
        remarque: voulue.remarque,
        placesInfo: voulue.placesInfo,
        urlProgramme: voulue.urlProgramme,
        sourceUrl: voulue.sourceUrl,
        firstSeen: voulue.firstSeen,
        lastSeen: voulue.lastSeen,
        syncedAt: maintenant,
      },
    });
  }
  compte.sessionsMajs = aMettreAJour.length;

  for (const lot of lots(aSupprimer)) {
    await prisma.session.deleteMany({ where: { id: { in: lot } } });
  }
  compte.sessionsRetirees = aSupprimer.length;

  return compte;
}

// --- Passage complet ---------------------------------------------------------

export type Declencheur = "manuel" | "auto" | "cron";

export async function synchroniser(
  declencheur: Declencheur
): Promise<ResultatSync> {
  const config = await lireConfigBackend();

  if (config.mode === "off") {
    return {
      ...VIDE,
      statut: "ignore",
      message: "Liaison backend désactivée.",
      mode: config.mode,
      dureeMs: 0,
    };
  }

  if (!(await prendreVerrou())) {
    return {
      ...VIDE,
      statut: "ignore",
      message: "Une synchronisation est déjà en cours.",
      mode: config.mode,
      dureeMs: 0,
    };
  }

  const debut = Date.now();
  const run = await prisma.syncRun.create({
    data: { mode: config.mode, declencheur, statut: "en_cours" },
    select: { id: true },
  });

  try {
    const connecteur = creerConnecteur(config);
    const lignes = await connecteur.lireSessions();

    if (lignes.length === 0) {
      throw new ErreurBackend(
        "Le backend n'a renvoyé aucune session — passage interrompu pour ne pas vider le catalogue."
      );
    }

    const compte = await appliquerLignes(lignes);
    const dureeMs = Date.now() - debut;

    await prisma.syncRun.update({
      where: { id: run.id },
      data: { ...compte, statut: "ok", termineLe: new Date(), dureeMs },
    });

    return { ...compte, statut: "ok", message: null, mode: config.mode, dureeMs };
  } catch (err) {
    const dureeMs = Date.now() - debut;
    const message =
      err instanceof Error ? err.message : "Erreur inconnue pendant la synchronisation";

    // Collecte en cours : ce n'est pas une panne. Le passage est consigné comme
    // ignoré, donc `dernierPassageReussi` ne bouge pas — le rafraîchissement
    // automatique réessaiera à la visite suivante plutôt que d'attendre la
    // fraîcheur complète, et le site ne restera pas sur un catalogue partiel.
    if (err instanceof CollecteEnCours) {
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          statut: "ignore",
          termineLe: new Date(),
          dureeMs,
          message: message.slice(0, 2000),
        },
      });
      return {
        ...VIDE,
        statut: "ignore",
        message,
        mode: config.mode,
        dureeMs,
      };
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        statut: "erreur",
        termineLe: new Date(),
        dureeMs,
        message: message.slice(0, 2000),
      },
    });

    return {
      ...VIDE,
      statut: "erreur",
      message,
      mode: config.mode,
      dureeMs,
    };
  } finally {
    await rendreVerrou();
  }
}

export async function dernierPassageReussi() {
  return prisma.syncRun.findFirst({
    where: { statut: "ok" },
    orderBy: { demarreLe: "desc" },
  });
}

// Un passage réussi qui date de plus de deux fois la fraîcheur demandée
// signale une liaison en peine (backend éteint, jeton révoqué, chemin de base
// devenu faux) : le tableau de bord s'en sert pour alerter.
export function passageEnRetard(
  dernier: { demarreLe: Date } | null,
  ttlMinutes: number
): boolean {
  if (!dernier) return true;
  return Date.now() - dernier.demarreLe.getTime() > ttlMinutes * 60_000 * 2;
}

export async function derniersPassages(limite = 10) {
  return prisma.syncRun.findMany({
    orderBy: { demarreLe: "desc" },
    take: limite,
  });
}
