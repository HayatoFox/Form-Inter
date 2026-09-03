import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Jeu de démonstration — `npm run db:demo`.
 *
 * Remplit la base du site avec un catalogue réaliste (organismes, domaines,
 * villes et intitulés réels du secteur) sans avoir à lancer le backend ni à
 * attendre une collecte de quinze minutes. Utile pour juger l'interface, pas
 * pour valider la synchronisation — les lignes créées ici portent
 * `source = "BACKEND"` mais aucune `sourceRef` cohérente avec un vrai backend.
 *
 * Le jeu couvre volontairement les cas qui font tomber une mise en page :
 * intitulés très longs, sessions à entrée permanente sans dates, durées
 * décimales, disponibilité tendue, tarifs absents, sessions déjà passées.
 *
 * ⚠ Le script VIDE les données métier existantes. Il refuse de tourner avec
 * NODE_ENV=production.
 */

if (process.env.NODE_ENV === "production") {
  console.error(
    "db:demo écrase les données : refus de tourner avec NODE_ENV=production."
  );
  process.exit(1);
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Générateur déterministe : deux exécutions donnent le même catalogue, ce qui
// permet de comparer deux captures d'écran sans que les données bougent.
let graine = 20260729;
function alea(): number {
  graine = (graine * 1103515245 + 12345) & 0x7fffffff;
  return graine / 0x7fffffff;
}
function parmi<T>(liste: readonly T[]): T {
  return liste[Math.floor(alea() * liste.length)];
}

const ORGANISMES = [
  { nom: "PILOCAP", siteWeb: "https://formation-pilocap.fr", tarifs: false },
  { nom: "TEMIS Formation", siteWeb: "https://www.temis-formation.fr", tarifs: true },
  { nom: "CEPIM", siteWeb: "https://www.cepim.fr", tarifs: true },
  { nom: "Groupe ACN", siteWeb: "https://www.groupe-acn.fr", tarifs: true },
  { nom: "VoltWork", siteWeb: "https://www.voltwork.fr", tarifs: true },
  { nom: "Formaphénix", siteWeb: "https://www.formaphenix.fr", tarifs: true },
];

// Les quatorze domaines de `scraper/domaines.py`, avec des intitulés du métier :
// c'est ce qui met la palette à l'épreuve pour de bon.
const CATALOGUE: Record<string, string[]> = {
  Secourisme: [
    "SST - Formation initiale",
    "SST - Maintien et actualisation des compétences",
    "PSC1 - Prévention et secours civiques niveau 1",
    "Défibrillateur automatisé externe - Sensibilisation",
  ],
  "CACES / Conduite d'engins": [
    "CACES R489 catégorie 1A - Transpalette à conducteur porté",
    "CACES R489 catégorie 3 - Chariot élévateur frontal",
    "CACES R489 catégorie 5 - Chariot à mât rétractable",
    "CACES R486 catégorie B - Plateforme élévatrice mobile de personnes",
    "CACES R482 catégorie A - Engins de chantier compacts",
    "CACES R485 catégorie 2 - Gerbeur à conducteur accompagnant",
    "Pont roulant et élingage - Conduite au sol",
  ],
  "Habilitations électriques": [
    "Habilitation électrique B0-H0-H0V - Personnel non électricien",
    "Habilitation électrique B1V-B2V-BR-BC - Personnel électricien",
    "Habilitation électrique BS-BE Manœuvre",
    "Recyclage habilitation électrique - Toutes catégories",
    "IRVE niveau 1 - Infrastructure de recharge de véhicules électriques",
  ],
  "Travail en hauteur": [
    "Travail en hauteur et port du harnais antichute",
    "Montage, démontage et vérification d'échafaudage roulant R457",
    "Vérification périodique des EPI antichute",
  ],
  Incendie: [
    "Équipier de première intervention - Manipulation d'extincteurs",
    "Guide-file et serre-file - Évacuation des locaux",
    "SSIAP 1 - Recyclage",
    "Permis feu - Travaux par points chauds",
  ],
  AIPR: ["AIPR Opérateur", "AIPR Encadrant", "AIPR Concepteur"],
  "CSE / CSSCT": [
    "CSE - Formation des membres élus (entreprise de moins de 300 salariés)",
    "CSSCT - Santé, sécurité et conditions de travail",
  ],
  "Gestes et postures / Ergonomie": [
    "Gestes et postures - Manutention manuelle de charges",
    "Prévention des troubles musculo-squelettiques",
    "Ergonomie du travail sur écran",
  ],
  "Risques chimiques": [
    "Risque chimique niveau 1 - Sensibilisation",
    "ATEX niveau 0 - Atmosphères explosives",
  ],
  "Espaces confinés (CATEC)": [
    "CATEC - Certificat d'aptitude à travailler en espaces confinés",
  ],
  Ferroviaire: ["Sécurité ferroviaire SECUFER - Personnel intervenant sur le RFN"],
  "Hygiène alimentaire": [
    "HACCP - Hygiène alimentaire en restauration commerciale",
  ],
  "Risques psychosociaux / Conflits": [
    "Prévention des risques psychosociaux",
    "Gestion des incivilités et de l'agressivité au guichet",
  ],
  "Formation de formateur": [
    "Formateur SST - Certificat de formateur",
    "Formateur en gestes et postures",
  ],
};

/**
 * Les villes du jeu de démonstration, AVEC LEURS COORDONNÉES.
 *
 * Elles sont écrites en dur, et c'est délibéré : le filtre par distance et la
 * carte ne servent à rien tant que les centres ne sont pas situés. Sans ces
 * valeurs, une installation neuve devrait géocoder quarante adresses à une
 * requête par seconde avant de pouvoir essayer quoi que ce soit. Là, le jeu de
 * démonstration est utilisable immédiatement, et il ne coûte pas un seul appel
 * à OpenStreetMap.
 *
 * Les coordonnées viennent de Nominatim, relevées une fois. Vitrolles a été
 * retirée de la liste : la recherche renvoyait le Vitrolles des Hautes-Alpes
 * et non celui des Bouches-du-Rhône, et mieux vaut une ville de moins qu'une
 * coordonnée fausse dans un jeu qui sert justement à vérifier des distances.
 */
const VILLES: Record<string, [number, number]> = {
  "Bordeaux": [44.84123, -0.58004],
  "Nantes": [47.21864, -1.55414],
  "Rennes": [48.11134, -1.68002],
  "Le Mans": [48.00738, 0.19678],
  "Angers": [47.47399, -0.55156],
  "Tours": [47.39005, 0.68893],
  "Angoulême": [45.64845, 0.15619],
  "La Rochelle": [46.15973, -1.1516],
  "Poitiers": [46.58026, 0.3402],
  "Limoges": [45.83542, 1.26448],
  "Niort": [46.32392, -0.46461],
  "Saint-Nazaire": [47.27335, -2.21389],
  "Vannes": [47.65868, -2.75991],
  "Brest": [48.39053, -4.48601],
  "Rouen": [49.44046, 1.09397],
  "Caen": [49.18134, -0.36356],
  "Le Havre": [49.4939, 0.10797],
  "Lille": [50.63657, 3.06353],
  "Amiens": [49.89417, 2.2957],
  "Reims": [49.25779, 4.03193],
  "Metz": [49.1197, 6.17636],
  "Nancy": [48.69372, 6.18341],
  "Strasbourg": [48.58461, 7.75071],
  "Dijon": [47.32158, 5.04147],
  "Lyon": [45.75781, 4.83201],
  "Grenoble": [45.18756, 5.73578],
  "Clermont-Ferrand": [45.77746, 3.08194],
  "Marseille": [43.2964, 5.37779],
  "Aix-en-Provence": [43.52984, 5.44747],
  "Nice": [43.70094, 7.26839],
  "Toulon": [43.12573, 5.93049],
  "Montpellier": [43.61124, 3.87673],
  "Nîmes": [43.83742, 4.36007],
  "Toulouse": [43.60446, 1.44424],
  "Pau": [43.29575, -0.36857],
  "Bayonne": [43.49451, -1.47367],
  "Paris": [48.85889, 2.32004],
  "Créteil": [48.77715, 2.45307],
  "Versailles": [48.80354, 2.12669],
};

const NOMS_VILLES = Object.keys(VILLES);

const DISPONIBILITES = [
  "Places disponibles", "Places disponibles", "Places disponibles",
  "Dernières places disponibles", "Complet", null, null,
];

const TYPES_ORIGINE = [
  "Prévention des risques", "Sécurité au travail", "Levage et manutention",
  "Habilitations", "Secourisme", "Réglementaire",
];

const jour = 24 * 60 * 60 * 1000;

/** Date calendaire à minuit UTC, comme partout dans le site. */
function dateA(offsetJours: number): Date {
  const maintenant = new Date();
  const base = Date.UTC(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate()
  );
  return new Date(base + offsetJours * jour);
}

async function main() {
  console.log("Nettoyage des données métier…");
  await prisma.organisme.deleteMany({}); // cascade : centres, formations, sessions
  await prisma.domaine.deleteMany({});

  console.log("Création des domaines…");
  const domaines = new Map<string, string>();
  for (const nom of Object.keys(CATALOGUE)) {
    const d = await prisma.domaine.create({
      data: { nom, source: "BACKEND" },
      select: { id: true },
    });
    domaines.set(nom, d.id);
  }

  let nbFormations = 0;
  let nbSessions = 0;

  for (const org of ORGANISMES) {
    const organisme = await prisma.organisme.create({
      data: { nom: org.nom, siteWeb: org.siteWeb, source: "BACKEND" },
      select: { id: true },
    });

    // Chaque organisme couvre une poignée de villes, pas les quarante.
    const villes: string[] = [];
    while (villes.length < 4 + Math.floor(alea() * 9)) {
      const v = parmi(NOMS_VILLES);
      if (!villes.includes(v)) villes.push(v);
    }
    const centres = new Map<string, string>();
    for (const ville of villes) {
      const [latitude, longitude] = VILLES[ville];
      const c = await prisma.centre.create({
        // Les coordonnées sont posées d'emblée et l'état marqué « ok » : le
        // filtre par distance et la carte marchent dès la première seconde,
        // sans passer par le géocodage.
        data: {
          nom: ville,
          ville,
          organismeId: organisme.id,
          source: "BACKEND",
          latitude,
          longitude,
          geoStatut: "ok",
          geoRequete: `${ville}, france`,
          geoLibelle: `${ville}, France`,
          geoLe: new Date(),
        },
        select: { id: true },
      });
      centres.set(ville, c.id);
    }

    // …et une partie du catalogue, pour que les organismes ne soient pas
    // interchangeables dans les filtres.
    for (const [domaine, intitules] of Object.entries(CATALOGUE)) {
      if (alea() < 0.2) continue;

      for (const intitule of intitules) {
        if (alea() < 0.15) continue;

        const dureeJours = parmi([0.5, 1, 1, 2, 2, 3, 3, 4, 7]);
        const formation = await prisma.formation.create({
          data: {
            intitule,
            organismeId: organisme.id,
            domaineId: domaines.get(domaine)!,
            typeFormation: parmi(TYPES_ORIGINE),
            dureeValeur: dureeJours,
            dureeUnite: "jours",
            urlProgramme: `${org.siteWeb}/programme/${nbFormations}`,
            source: "BACKEND",
          },
          select: { id: true },
        });
        nbFormations += 1;

        const sessions: {
          formationId: string;
          centreId: string;
          dateDebut: Date | null;
          dateFin: Date | null;
          permanente: boolean;
          dureeJours: number;
          tarif: string | null;
          placesInfo: string | null;
          remarque: string | null;
          sourceUrl: string;
          source: string;
          sourceRef: string;
          firstSeen: Date;
          lastSeen: Date;
          syncedAt: Date;
        }[] = [];

        // Une vingtaine de dates par formation en moyenne : c'est le rapport
        // observé en production (~3 900 sessions pour ~200 formations), et
        // c'est lui qui met la pagination et les modales à l'épreuve.
        const nbDates = 4 + Math.floor(alea() * 32);
        for (let i = 0; i < nbDates; i++) {
          // Quelques sessions déjà passées, pour vérifier le repli « passées ».
          const depart = Math.floor(alea() * 300) - (alea() < 0.12 ? 60 : 0);
          const ville = parmi(villes);
          const debut = dateA(depart);
          sessions.push({
            formationId: formation.id,
            centreId: centres.get(ville)!,
            dateDebut: debut,
            dateFin: new Date(debut.getTime() + Math.ceil(dureeJours - 1) * jour),
            permanente: false,
            dureeJours,
            tarif: org.tarifs
              ? parmi([
                  `${250 + Math.floor(alea() * 40) * 10} € H.T/pers`,
                  `À partir de : ${300 + Math.floor(alea() * 30) * 10} €`,
                  null,
                ])
              : null,
            placesInfo: parmi(DISPONIBILITES),
            remarque: null,
            sourceUrl: `${org.siteWeb}/planning/${ville.toLowerCase()}`,
            source: "BACKEND",
            sourceRef: `${org.nom}|${intitule}|${ville}|${debut.toISOString().slice(0, 10)}|demo-${nbSessions + i}`,
            firstSeen: dateA(-3),
            lastSeen: dateA(0),
            syncedAt: new Date(),
          });
        }

        // PILOCAP publie des offres à entrée/sortie permanente : dates nulles.
        if (org.nom === "PILOCAP" && alea() < 0.4) {
          const ville = parmi(villes);
          sessions.push({
            formationId: formation.id,
            centreId: centres.get(ville)!,
            dateDebut: null,
            dateFin: null,
            permanente: true,
            dureeJours,
            tarif: null,
            placesInfo: null,
            remarque: "Session ouverte toutes les semaines",
            sourceUrl: `${org.siteWeb}/planning/${ville.toLowerCase()}`,
            source: "BACKEND",
            sourceRef: `${org.nom}|${intitule}|${ville}||demo-perm-${nbSessions}`,
            firstSeen: dateA(-3),
            lastSeen: dateA(0),
            syncedAt: new Date(),
          });
        }

        await prisma.session.createMany({ data: sessions });
        nbSessions += sessions.length;
      }
    }
    console.log(`  ${org.nom} : ${villes.length} villes`);
  }

  // Compte admin, pour pouvoir ouvrir /admin dans la foulée.
  // L'adresse par défaut doit être une adresse VALIDE : le formulaire de
  // connexion la valide avec `z.string().email()`, qui refuse « admin@local »
  // faute de point. Le compte existait, le mot de passe était bon, et la
  // connexion répondait « Email ou mot de passe invalide » — un 400 de
  // validation qu'on lisait comme un échec d'authentification.
  const email = process.env.ADMIN_EMAIL ?? "admin@proinsec.local";
  const motDePasse = process.env.ADMIN_PASSWORD_SEED ?? "demo";
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(motDePasse, 10) },
    create: { email, passwordHash: await bcrypt.hash(motDePasse, 10) },
  });

  console.log(
    `\n${nbFormations} formations, ${nbSessions} sessions, ${ORGANISMES.length} organismes, ${Object.keys(CATALOGUE).length} domaines.`
  );
  console.log(`Back office : ${email} / ${motDePasse}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
