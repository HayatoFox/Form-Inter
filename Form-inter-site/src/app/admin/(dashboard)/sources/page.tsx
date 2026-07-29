import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { lireConfigBackendPublique } from "@/lib/backend/config";
import { derniersPassages } from "@/lib/backend/sync";
import { BACKEND, MANUEL } from "@/lib/backend/types";
import { LiaisonBackend } from "@/components/admin/LiaisonBackend";

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  ok: { libelle: "OK", classe: "text-emerald-600" },
  erreur: { libelle: "Erreur", classe: "text-red-600" },
  en_cours: { libelle: "En cours", classe: "text-amber-600" },
  ignore: { libelle: "Reporté", classe: "text-zinc-500" },
};

export default async function AdminSourcesPage() {
  const [config, passages, backendCounts, manuelCounts] = await Promise.all([
    lireConfigBackendPublique(),
    derniersPassages(15),
    prisma.session.count({ where: { source: BACKEND } }),
    prisma.session.count({ where: { source: MANUEL } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sources de données
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Le catalogue du site se remplit de deux façons, qui cohabitent :
          l&apos;import d&apos;un fichier fourni par un organisme, et la liaison
          avec le backend de veille qui scrape les sites des organismes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-semibold">{backendCounts}</div>
          <div className="text-sm text-zinc-500">
            session(s) synchronisées depuis le backend
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-2xl font-semibold">{manuelCounts}</div>
          <div className="text-sm text-zinc-500">
            session(s) saisies ou importées à la main
          </div>
        </div>
      </div>

      <LiaisonBackend config={config} />

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">Import Excel / CSV</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pour les organismes qui transmettent un fichier plutôt qu&apos;un
          planning en ligne. Les lignes importées portent la source
          « manuelle » et survivent aux synchronisations.
        </p>
        <Link
          href="/admin/import"
          className="mt-3 inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Ouvrir l&apos;assistant d&apos;import
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">
          Derniers passages de synchronisation
        </h2>
        {passages.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aucune synchronisation n&apos;a encore été lancée.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Déclencheur</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Reçues</th>
                  <th className="py-2 pr-4">+ / ~ / −</th>
                  <th className="py-2">Durée</th>
                </tr>
              </thead>
              <tbody>
                {passages.map((p) => {
                  const statut = STATUTS[p.statut] ?? {
                    libelle: p.statut,
                    classe: "text-zinc-500",
                  };
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 align-top dark:border-zinc-800"
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {horodatage.format(p.demarreLe)}
                      </td>
                      <td className="py-2 pr-4">{p.declencheur}</td>
                      <td className="py-2 pr-4">{p.mode}</td>
                      <td className={`py-2 pr-4 ${statut.classe}`}>
                        {statut.libelle}
                        {p.message && (
                          <div className="max-w-md text-xs text-zinc-500">
                            {p.message}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">{p.lignesRecues}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {p.sessionsCreees} / {p.sessionsMajs} /{" "}
                        {p.sessionsRetirees}
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        {p.dureeMs === null
                          ? "—"
                          : `${(p.dureeMs / 1000).toFixed(1)} s`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
