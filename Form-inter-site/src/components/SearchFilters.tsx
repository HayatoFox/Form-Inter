import Link from "next/link";
import { CurseurRayon } from "@/components/CurseurRayon";

export type SearchFiltersProps = {
  domaines: { id: string; nom: string }[];
  organismes: { id: string; nom: string }[];
  villes: string[];
  current: {
    q?: string;
    domaine?: string;
    organisme?: string;
    ville?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Rayon autour de la ville, en kilomètres. 0 = la ville seule. */
    rayon?: number;
    passees?: boolean;
    permanentes?: boolean;
  };
};

export function SearchFilters({
  domaines,
  organismes,
  villes,
  current,
}: SearchFiltersProps) {
  return (
    <form
      method="get"
      action="/formations"
      className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-7 lg:items-end dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Distingue « formulaire soumis, cases décochées » de « premier
          affichage » : sans ce marqueur les cases reprendraient leur défaut. */}
      <input type="hidden" name="f" value="1" />

      <div className="lg:col-span-2">
        <label htmlFor="q" className="block text-xs font-medium text-zinc-500">
          Mot-clé
        </label>
        <input
          id="q"
          name="q"
          type="text"
          defaultValue={current.q}
          placeholder="Intitulé, description…"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div>
        <label htmlFor="domaine" className="block text-xs font-medium text-zinc-500">
          Domaine
        </label>
        <select
          id="domaine"
          name="domaine"
          defaultValue={current.domaine ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Tous</option>
          {domaines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ville" className="block text-xs font-medium text-zinc-500">
          Ville
        </label>
        <select
          id="ville"
          name="ville"
          defaultValue={current.ville ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Toutes</option>
          {villes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Le rayon vit collé à la ville, parce qu'il ne veut rien dire sans
          elle : « à moins de 30 km » de quoi ? Sans lui, chercher « Rennes »
          laisse de côté les centres de Cesson-Sévigné ou de Bruz, qui sont
          pourtant à un quart d'heure. */}
      <div>
        <CurseurRayon valeur={current.rayon ?? 0} />
      </div>

      <div>
        <label htmlFor="organisme" className="block text-xs font-medium text-zinc-500">
          Organisme
        </label>
        <select
          id="organisme"
          name="organisme"
          defaultValue={current.organisme ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Tous</option>
          {organismes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dateFrom" className="block text-xs font-medium text-zinc-500">
          Du
        </label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={current.dateFrom}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 lg:col-span-7">
        <div>
          <label htmlFor="dateTo" className="block text-xs font-medium text-zinc-500">
            Au
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={current.dateTo}
            className="mt-1 w-full max-w-[200px] rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="permanentes"
              value="1"
              defaultChecked={current.permanentes ?? true}
            />
            Sessions à entrée permanente
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="passees"
              value="1"
              defaultChecked={current.passees ?? false}
            />
            Inclure les sessions passées
          </label>
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Filtrer
        </button>
        <Link
          href="/formations"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Réinitialiser
        </Link>
      </div>
    </form>
  );
}
