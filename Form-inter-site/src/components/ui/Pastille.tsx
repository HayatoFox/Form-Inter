import { styleDomaine } from "@/lib/domaines";

/**
 * Pastille de domaine — la signature visuelle du site. Le même objet dans la
 * carte, la fiche, la modale et le filtre : c'est ce qui permet de repérer un
 * domaine d'un coup d'œil dans une liste longue, sans lire l'étiquette.
 */
export function Pastille({
  domaine,
  className = "",
}: {
  domaine: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={`pastille ${className}`} style={styleDomaine(domaine)}>
      {domaine ?? "Non classé"}
    </span>
  );
}

/** Le même repère réduit à un point, quand la place manque. */
export function PointDomaine({
  domaine,
  titre,
}: {
  domaine: string | null | undefined;
  titre?: string;
}) {
  return (
    <span
      className="pastille !border-transparent !bg-transparent !p-0"
      style={styleDomaine(domaine)}
      title={titre ?? domaine ?? "Non classé"}
      aria-hidden="true"
    />
  );
}

/** Étiquette neutre : provenance, type d'origine, compteurs. */
export function Etiquette({
  children,
  ton = "neutre",
}: {
  children: React.ReactNode;
  ton?: "neutre" | "marque" | "accent";
}) {
  const tons = {
    neutre: "border-bordure bg-surface-2 text-texte-doux",
    marque: "border-marque/25 bg-marque-douce text-marque",
    accent: "border-accent/30 bg-accent-douce text-accent",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tons[ton]}`}
    >
      {children}
    </span>
  );
}
