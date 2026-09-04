import type { Prisma } from "@/generated/prisma/client";

/**
 * Ce que la carte de résultat et sa modale affichent — et RIEN de plus.
 *
 * La liste demandait auparavant `include: { sessions: { include: { centre:
 * true } } }`, c'est-à-dire l'objet complet. Comme la carte est un composant
 * client, tout ce que la requête ramène est sérialisé dans la page pour
 * l'hydratation : `/formations` pesait **451 Ko de HTML** pour vingt cartes,
 * dont la moitié en champs que personne ne regarde — chaque session traînait
 * son centre entier (latitude, longitude, geoStatut, geoRequete, geoLibelle,
 * geoLe, source…) plus ses propres sourceRef, firstSeen, lastSeen, syncedAt,
 * permanente, formationId, centreId. Avec cette projection : 268 Ko.
 *
 * POURQUOI CE FICHIER EXISTE, et pourquoi la constante ne vit pas dans
 * `FormationCard.tsx` à côté des composants qui la lisent : ce fichier-là
 * porte `"use client"`, et une valeur exportée d'un module client N'ARRIVE PAS
 * dans un composant serveur — elle y vaut `undefined`. Le `select` devenait
 * alors `{ sessions: … }` tout court, `formation.organisme` était absent, et la
 * page rendait une erreur 500. Le projet s'était déjà fait prendre avec
 * `RAYON_MAX` (voir `src/lib/geo/rayon.ts`) : une constante partagée entre les
 * deux mondes doit vivre dans un module neutre.
 */
export const CHAMPS_CARTE = {
  id: true,
  intitule: true,
  description: true,
  dureeValeur: true,
  dureeUnite: true,
  typeFormation: true,
  urlProgramme: true,
  organisme: { select: { id: true, nom: true } },
  domaine: { select: { id: true, nom: true } },
  sessions: {
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      dureeJours: true,
      tarif: true,
      remarque: true,
      placesInfo: true,
      urlProgramme: true,
      sourceUrl: true,
      centre: { select: { nom: true, ville: true } },
    },
  },
} satisfies Prisma.FormationSelect;

/**
 * La forme reçue par `FormationCard` et `SessionsModal`. Ajouter un champ à
 * l'affichage sans l'ajouter ci-dessus casse la compilation — c'est
 * exactement le rappel qu'on veut.
 */
export type FormationCarte = Prisma.FormationGetPayload<{
  select: typeof CHAMPS_CARTE;
}>;
