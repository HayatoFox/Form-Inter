// Les dates manipulées par le site sont des dates *calendaires* (le jour d'une
// session), pas des instants : elles sont toutes stockées à minuit UTC et
// affichées en UTC. Sans cette convention, une date importée à minuit local
// s'affiche la veille dès que le serveur et le lecteur ne sont pas dans le
// même fuseau — le backend, lui, ne transmet que des `AAAA-MM-JJ`.

export function dateCalendaire(annee: number, mois: number, jour: number): Date {
  return new Date(Date.UTC(annee, mois - 1, jour));
}

// Ramène une Date quelconque (ex. cellule Excel lue en heure locale) au jour
// calendaire qu'elle représente, à minuit UTC.
export function normaliserDate(valeur: Date): Date {
  return dateCalendaire(
    valeur.getFullYear(),
    valeur.getMonth() + 1,
    valeur.getDate()
  );
}

// "AAAA-MM-JJ" -> minuit UTC. Renvoie null pour toute autre forme.
export function parseDateISO(texte: string | null | undefined): Date | null {
  if (!texte) return null;
  const m = texte.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const date = dateCalendaire(Number(m[1]), Number(m[2]), Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Minuit UTC du jour courant, tel que le voit le serveur : c'est la borne
// utilisée pour distinguer les sessions passées des sessions à venir.
/**
 * Minuit UTC du jour courant à Paris : la borne qui sépare les sessions
 * passées des sessions à venir.
 *
 * Le fuseau est nommé explicitement, et ce n'est pas un détail. Cette fonction
 * tourne aussi dans le navigateur (les cartes de formation sont des composants
 * clients) : si le serveur lisait sa date locale et le navigateur la sienne,
 * les deux ne tomberaient pas d'accord sur « aujourd'hui » entre minuit et
 * deux heures du matin. Un catalogue français a un seul aujourd'hui, celui de
 * Paris.
 */
const jourParis = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function debutDuJour(): Date {
  const [annee, mois, jour] = jourParis.format(new Date()).split("-").map(Number);
  return dateCalendaire(annee, mois, jour);
}

const courtFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const longFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDateCourt(date: Date): string {
  return courtFormatter.format(date);
}

export function formatDateLong(date: Date): string {
  return longFormatter.format(date);
}

// Valeur pour un <input type="date"> : "AAAA-MM-JJ" en UTC.
export function versInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Une session sans date de début est une offre à entrée/sortie permanente :
// l'absence de dates suffit à la reconnaître.
export type PeriodeSession = {
  dateDebut: Date | null;
  dateFin: Date | null;
};

// Libellé de période d'une session, y compris les sessions à entrée/sortie
// permanente du backend (dates nulles).
export function formatPeriode(
  session: PeriodeSession,
  format: (date: Date) => string = formatDateLong
): string {
  if (!session.dateDebut) return "Entrée/sortie permanente";
  const debut = format(session.dateDebut);
  if (!session.dateFin || session.dateFin.getTime() === session.dateDebut.getTime()) {
    return debut;
  }
  return `${debut} → ${format(session.dateFin)}`;
}
