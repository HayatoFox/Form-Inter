import { Prisma } from "@/generated/prisma/client";
import { debutDuJour, parseDateISO } from "@/lib/dates";

/**
 * Les critères de recherche du catalogue, en un seul endroit.
 *
 * Deux pages posent aujourd'hui la même question — la liste `/formations` et
 * la carte `/carte` — et une troisième la posera demain. Tant que chacune
 * reconstruisait son `where` dans son coin, « les formations qui correspondent »
 * n'avait pas la même définition d'une page à l'autre : il suffisait d'ajouter
 * un filtre d'un côté pour que les deux ne comptent plus pareil, sans que rien
 * ne le signale.
 *
 * Ce module décide, une fois : ce qu'on lit dans l'URL, et ce que ça donne en
 * conditions Prisma.
 */

export type Criteres = {
  q?: string;
  domaineId?: string;
  organismeId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Inclure les sessions déjà terminées. */
  passees: boolean;
  /** Inclure les sessions à entrée/sortie permanente (sans date). */
  permanentes: boolean;
};

/** Ce qu'une page lit dans son URL, avant interprétation. */
export type ParamsRecherche = {
  q?: string;
  domaine?: string;
  organisme?: string;
  dateFrom?: string;
  dateTo?: string;
  passees?: string;
  permanentes?: string;
  /** Marqueur de formulaire soumis : sans lui, les cases prennent leur défaut. */
  f?: string;
};

/**
 * Le marqueur `f` distingue « formulaire soumis, cases décochées » de « premier
 * affichage » : sans lui, décocher « sessions à entrée permanente » n'aurait
 * aucun effet, la case reprenant son défaut à chaque soumission.
 */
export function lireCriteres(params: ParamsRecherche): Criteres {
  const soumis = params.f === "1";
  return {
    q: params.q?.trim() || undefined,
    domaineId: params.domaine || undefined,
    organismeId: params.organisme || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    passees: soumis && params.passees === "1",
    permanentes: soumis ? params.permanentes === "1" : true,
  };
}

/** La même lecture, depuis les paramètres d'une requête d'API. */
export function lireCriteresURL(params: URLSearchParams): Criteres {
  return lireCriteres({
    q: params.get("q") ?? undefined,
    domaine: params.get("domaine") ?? undefined,
    organisme: params.get("organisme") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    passees: params.get("passees") ?? undefined,
    permanentes: params.get("permanentes") ?? undefined,
    f: params.get("f") ?? undefined,
  });
}

/**
 * Traduit les critères en conditions Prisma.
 *
 * `restrictionLieu` est la part géographique, que chaque page formule à sa
 * manière : la liste part d'un nom de ville, la carte d'une liste
 * d'identifiants de centres déjà calculée. Le reste est commun.
 */
export function construireFiltres(
  criteres: Criteres,
  restrictionLieu?: Prisma.SessionWhereInput
): {
  sessionFilter: Prisma.SessionWhereInput | undefined;
  formationFilter: Prisma.FormationWhereInput;
} {
  const aujourdhui = debutDuJour();

  // Contraintes portant sur les sessions datées. Les sessions à entrée/sortie
  // permanente (dateDebut nulle) n'y sont pas soumises : elles sont incluses ou
  // exclues en bloc.
  const contraintesDatees: Prisma.SessionWhereInput[] = [];
  if (!criteres.passees) {
    contraintesDatees.push({
      OR: [
        { dateFin: { gte: aujourdhui } },
        { dateFin: null, dateDebut: { gte: aujourdhui } },
      ],
    });
  }
  const borneDu = parseDateISO(criteres.dateFrom);
  const borneAu = parseDateISO(criteres.dateTo);
  if (borneDu) contraintesDatees.push({ dateDebut: { gte: borneDu } });
  if (borneAu) contraintesDatees.push({ dateDebut: { lte: borneAu } });

  const conditions: Prisma.SessionWhereInput[] = [];
  if (restrictionLieu) conditions.push(restrictionLieu);

  if (contraintesDatees.length > 0) {
    const datees: Prisma.SessionWhereInput = {
      AND: [{ dateDebut: { not: null } }, ...contraintesDatees],
    };
    conditions.push(
      criteres.permanentes ? { OR: [{ dateDebut: null }, datees] } : datees
    );
  } else if (!criteres.permanentes) {
    conditions.push({ dateDebut: { not: null } });
  }

  const sessionFilter =
    conditions.length > 0 ? { AND: conditions } : undefined;

  const formationFilter: Prisma.FormationWhereInput = {
    ...(criteres.domaineId && { domaineId: criteres.domaineId }),
    ...(criteres.organismeId && { organismeId: criteres.organismeId }),
    ...(criteres.q && {
      OR: [
        { intitule: { contains: criteres.q } },
        { description: { contains: criteres.q } },
      ],
    }),
    ...(sessionFilter && { sessions: { some: sessionFilter } }),
  };

  return { sessionFilter, formationFilter };
}

/**
 * Le visiteur a-t-il lui-même restreint la recherche ? La borne « à venir »
 * posée par défaut n'est pas un filtre de sa part : sans cette distinction, les
 * cartes annonceraient des « sessions correspondantes » alors que personne n'a
 * rien demandé.
 */
export function filtreExplicite(
  criteres: Criteres,
  params: ParamsRecherche & { ville?: string }
): boolean {
  return Boolean(
    params.ville || criteres.dateFrom || criteres.dateTo || params.f === "1"
  );
}

/** Reconstruit une chaîne de requête à partir des critères retenus. */
export function parametresRecherche(
  criteres: Criteres,
  extra: Record<string, string | number | undefined> = {}
): URLSearchParams {
  const sp = new URLSearchParams();
  if (criteres.q) sp.set("q", criteres.q);
  if (criteres.domaineId) sp.set("domaine", criteres.domaineId);
  if (criteres.organismeId) sp.set("organisme", criteres.organismeId);
  if (criteres.dateFrom) sp.set("dateFrom", criteres.dateFrom);
  if (criteres.dateTo) sp.set("dateTo", criteres.dateTo);
  sp.set("f", "1");
  if (criteres.passees) sp.set("passees", "1");
  if (criteres.permanentes) sp.set("permanentes", "1");
  for (const [cle, valeur] of Object.entries(extra)) {
    if (valeur !== undefined && valeur !== "") sp.set(cle, String(valeur));
  }
  return sp;
}
