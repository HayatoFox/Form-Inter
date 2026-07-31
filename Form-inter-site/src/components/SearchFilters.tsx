import Link from "next/link";
import { action, cadre, champ, legende } from "@/lib/ui";

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

/** Reconstruit l'URL du calendrier en retirant un filtre. */
function sans(courants: FiltresCourants, cle: keyof FiltresCourants): string {
  const p = new URLSearchParams();
  p.set("f", "1");
  const reste = { ...courants, [cle]: undefined };
  if (reste.q) p.set("q", reste.q);
  if (reste.domaine) p.set("domaine", reste.domaine);
  if (reste.ville) p.set("ville", reste.ville);
  if (reste.organisme) p.set("organisme", reste.organisme);
  if (reste.dateFrom) p.set("dateFrom", reste.dateFrom);
  if (reste.dateTo) p.set("dateTo", reste.dateTo);
  if (reste.passees) p.set("passees", "1");
  if (reste.permanentes ?? true) p.set("permanentes", "1");
  return `/formations?${p}`;
}

/**
 * Un terme actif du récapitulatif. Ce n'est pas une pastille teintée : c'est le
 * mot lui-même, souligné, qu'on clique pour le retirer. La phrase se lit, et la
 * hiérarchie vient du texte plutôt que d'une boîte autour de chaque nom.
 */
function Terme({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title="Retirer ce filtre"
      className="text-encre underline decoration-trait-fort decoration-1 underline-offset-[3px] transition-colors hover:text-erreur hover:decoration-erreur"
    >
      {children}
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

  const termes: React.ReactNode[] = [];
  if (current.q)
    termes.push(
      <Terme key="q" href={sans(current, "q")}>
        « {current.q} »
      </Terme>
    );
  if (nomDomaine)
    termes.push(
      <Terme key="d" href={sans(current, "domaine")}>
        {nomDomaine}
      </Terme>
    );
  if (current.ville)
    termes.push(
      <Terme key="v" href={sans(current, "ville")}>
        {current.ville}
      </Terme>
    );
  if (nomOrganisme)
    termes.push(
      <Terme key="o" href={sans(current, "organisme")}>
        {nomOrganisme}
      </Terme>
    );
  if (current.dateFrom)
    termes.push(
      <Terme key="du" href={sans(current, "dateFrom")}>
        à partir du <span className="donnee">{current.dateFrom}</span>
      </Terme>
    );
  if (current.dateTo)
    termes.push(
      <Terme key="au" href={sans(current, "dateTo")}>
        jusqu&apos;au <span className="donnee">{current.dateTo}</span>
      </Terme>
    );
  if (current.passees)
    termes.push(
      <Terme key="p" href={sans(current, "passees")}>
        sessions passées comprises
      </Terme>
    );
  if (current.permanentes === false)
    termes.push(
      <Terme key="perm" href={sans(current, "permanentes")}>
        entrées permanentes exclues
      </Terme>
    );

  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action="/formations"
        className={`${cadre} grid grid-cols-1 gap-x-4 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-12`}
      >
        {/* Distingue « formulaire soumis, cases décochées » de « premier
            affichage » : sans ce marqueur les cases reprendraient leur défaut. */}
        <input type="hidden" name="f" value="1" />

        <div className="lg:col-span-4">
          <label htmlFor="q" className={legende}>
            Mot-clé
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={current.q}
            placeholder="Intitulé, description"
            className={`${champ} mt-1`}
          />
        </div>

        <div className="lg:col-span-3">
          <label htmlFor="domaine" className={legende}>
            Domaine
          </label>
          <select
            id="domaine"
            name="domaine"
            defaultValue={current.domaine ?? ""}
            className={`${champ} mt-1`}
          >
            <option value="">Tous</option>
            {domaines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="ville" className={legende}>
            Ville
          </label>
          <select
            id="ville"
            name="ville"
            defaultValue={current.ville ?? ""}
            className={`${champ} mt-1`}
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
          <label htmlFor="organisme" className={legende}>
            Organisme
          </label>
          <select
            id="organisme"
            name="organisme"
            defaultValue={current.organisme ?? ""}
            className={`${champ} mt-1`}
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
          <label htmlFor="dateFrom" className={legende}>
            À partir du
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={current.dateFrom}
            className={`${champ} donnee mt-1`}
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="dateTo" className={legende}>
            Jusqu&apos;au
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={current.dateTo}
            className={`${champ} donnee mt-1`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-encre-2 sm:col-span-2 lg:col-span-8 lg:justify-end">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="permanentes"
              value="1"
              defaultChecked={current.permanentes ?? true}
              className="h-4 w-4 accent-[var(--encre)]"
            />
            Entrées permanentes
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="passees"
              value="1"
              defaultChecked={current.passees ?? false}
              className="h-4 w-4 accent-[var(--encre)]"
            />
            Sessions passées
          </label>
          {/* Sur mobile le bouton prend sa propre ligne : coincé à côté d'une
              case à cocher, il se lit comme un troisième choix. */}
          <button type="submit" className={`${action} w-full sm:w-auto`}>
            Filtrer
          </button>
        </div>
      </form>

      {/* Les filtres actifs se lisent comme une phrase, pas comme une rangée
          d'étiquettes : chaque terme est cliquable pour se retirer seul. */}
      {termes.length > 0 && (
        <p className="text-sm text-encre-3">
          Filtré sur{" "}
          {termes.map((t, i) => (
            <span key={i}>
              {i > 0 && (i === termes.length - 1 ? " et " : ", ")}
              {t}
            </span>
          ))}
          .{" "}
          <Link
            href="/formations"
            className="text-encre-3 underline decoration-trait decoration-1 underline-offset-[3px] transition-colors hover:text-encre"
          >
            Tout effacer
          </Link>
        </p>
      )}
    </div>
  );
}
