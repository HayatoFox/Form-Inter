import Link from "next/link";
import { Pastille } from "@/components/ui/Pastille";
import { boutonPrimaire, carte, champ, etiquette } from "@/lib/ui";

export type FiltresCourants = {
  q?: string;
  domaine?: string;
  organisme?: string;
  ville?: string;
  dateFrom?: string;
  dateTo?: string;
  passees?: boolean;
  permanentes?: boolean;
};

export type SearchFiltersProps = {
  domaines: { id: string; nom: string }[];
  organismes: { id: string; nom: string }[];
  villes: string[];
  current: FiltresCourants;
};

/**
 * Reconstruit l'URL de la liste en retirant un filtre : c'est ce qui permet aux
 * pastilles de récapitulatif d'être cliquables pour se défaire une par une,
 * sans JavaScript.
 */
function sans(courants: FiltresCourants, cle: keyof FiltresCourants): string {
  const params = new URLSearchParams();
  params.set("f", "1");
  const restant = { ...courants, [cle]: undefined };

  if (restant.q) params.set("q", restant.q);
  if (restant.domaine) params.set("domaine", restant.domaine);
  if (restant.ville) params.set("ville", restant.ville);
  if (restant.organisme) params.set("organisme", restant.organisme);
  if (restant.dateFrom) params.set("dateFrom", restant.dateFrom);
  if (restant.dateTo) params.set("dateTo", restant.dateTo);
  if (restant.passees) params.set("passees", "1");
  if (restant.permanentes ?? true) params.set("permanentes", "1");

  return `/formations?${params}`;
}

function Retrait({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-full border border-bordure bg-surface py-1 pr-1.5 pl-2.5 text-xs text-texte-doux transition-colors hover:border-bordure-forte hover:text-texte"
    >
      {children}
      <span
        aria-hidden="true"
        className="grid h-4 w-4 place-items-center rounded-full text-texte-tenu transition-colors group-hover:bg-erreur-fond group-hover:text-erreur"
      >
        ✕
      </span>
    </Link>
  );
}

export function SearchFilters({
  domaines,
  organismes,
  villes,
  current,
}: SearchFiltersProps) {
  const nomDomaine = domaines.find((d) => d.id === current.domaine)?.nom;
  const nomOrganisme = organismes.find((o) => o.id === current.organisme)?.nom;

  // « Filtre actif » au sens du visiteur : les deux cases ont un défaut, seul
  // leur écart au défaut compte.
  const actifs = [
    current.q,
    current.domaine,
    current.ville,
    current.organisme,
    current.dateFrom,
    current.dateTo,
    current.passees ? "passees" : undefined,
    current.permanentes === false ? "permanentes" : undefined,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action="/formations"
        className={`${carte} grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-12`}
      >
        {/* Distingue « formulaire soumis, cases décochées » de « premier
            affichage » : sans ce marqueur les cases reprendraient leur défaut. */}
        <input type="hidden" name="f" value="1" />

        <div className="lg:col-span-4">
          <label htmlFor="q" className={etiquette}>
            Mot-clé
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={current.q}
            placeholder="Intitulé, description…"
            className={`${champ} mt-1.5`}
          />
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="domaine" className={etiquette}>
            Domaine
          </label>
          <select
            id="domaine"
            name="domaine"
            defaultValue={current.domaine ?? ""}
            className={`${champ} mt-1.5`}
          >
            <option value="">Tous les domaines</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="ville" className={etiquette}>
            Ville
          </label>
          <select
            id="ville"
            name="ville"
            defaultValue={current.ville ?? ""}
            className={`${champ} mt-1.5`}
          >
            <option value="">Toutes</option>
            {villes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="organisme" className={etiquette}>
            Organisme
          </label>
          <select
            id="organisme"
            name="organisme"
            defaultValue={current.organisme ?? ""}
            className={`${champ} mt-1.5`}
          >
            <option value="">Tous</option>
            {organismes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="dateFrom" className={etiquette}>
            À partir du
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={current.dateFrom}
            className={`${champ} chiffres mt-1.5`}
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="dateTo" className={etiquette}>
            Jusqu&apos;au
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={current.dateTo}
            className={`${champ} chiffres mt-1.5`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-texte-doux sm:col-span-2 lg:col-span-6 lg:justify-end">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="permanentes"
              value="1"
              defaultChecked={current.permanentes ?? true}
              className="h-4 w-4 accent-[var(--action)]"
            />
            Entrées permanentes
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="passees"
              value="1"
              defaultChecked={current.passees ?? false}
              className="h-4 w-4 accent-[var(--action)]"
            />
            Sessions passées
          </label>
          <button type="submit" className={boutonPrimaire}>
            Filtrer
          </button>
        </div>
      </form>

      {actifs > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-texte-tenu uppercase">
            Filtres actifs
          </span>

          {current.q && (
            <Retrait href={sans(current, "q")}>
              <span className="text-texte-tenu">Mot-clé</span> {current.q}
            </Retrait>
          )}
          {nomDomaine && (
            <Retrait href={sans(current, "domaine")}>
              <Pastille domaine={nomDomaine} className="!border-0 !bg-transparent !px-0" />
            </Retrait>
          )}
          {current.ville && (
            <Retrait href={sans(current, "ville")}>
              <span className="text-texte-tenu">Ville</span> {current.ville}
            </Retrait>
          )}
          {nomOrganisme && (
            <Retrait href={sans(current, "organisme")}>
              <span className="text-texte-tenu">Organisme</span> {nomOrganisme}
            </Retrait>
          )}
          {current.dateFrom && (
            <Retrait href={sans(current, "dateFrom")}>
              <span className="text-texte-tenu">Dès le</span>{" "}
              <span className="chiffres">{current.dateFrom}</span>
            </Retrait>
          )}
          {current.dateTo && (
            <Retrait href={sans(current, "dateTo")}>
              <span className="text-texte-tenu">Jusqu&apos;au</span>{" "}
              <span className="chiffres">{current.dateTo}</span>
            </Retrait>
          )}
          {current.passees && (
            <Retrait href={sans(current, "passees")}>
              Sessions passées incluses
            </Retrait>
          )}
          {current.permanentes === false && (
            <Retrait href={sans(current, "permanentes")}>
              Permanentes exclues
            </Retrait>
          )}

          <Link
            href="/formations"
            className="ml-1 text-xs text-texte-doux underline-offset-2 hover:text-texte hover:underline"
          >
            Tout effacer
          </Link>
        </div>
      )}
    </div>
  );
}
