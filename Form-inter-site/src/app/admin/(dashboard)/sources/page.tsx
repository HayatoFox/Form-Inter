import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { lireConfigBackendPublique } from "@/lib/backend/config";
import { derniersPassages } from "@/lib/backend/sync";
import { BACKEND, MANUEL } from "@/lib/backend/types";
import { Nombre } from "@/components/Nombre";
import { LiaisonBackend } from "@/components/admin/LiaisonBackend";
import { Localisation } from "@/components/admin/Localisation";
import { etatLocalisation } from "@/lib/geo/centres";
import { statistiquesCache } from "@/lib/geo/nominatim";

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  ok: { libelle: "OK", classe: "text-vif" },
  erreur: { libelle: "Erreur", classe: "text-erreur" },
  en_cours: { libelle: "En cours", classe: "text-alerte" },
  ignore: { libelle: "Reporté", classe: "text-encre-2" },
};

export default async function AdminSourcesPage() {
  const [config, passages, backendCounts, manuelCounts, etatGeo, cacheGeo] =
    await Promise.all([
      lireConfigBackendPublique(),
      derniersPassages(15),
      prisma.session.count({ where: { source: BACKEND } }),
      prisma.session.count({ where: { source: MANUEL } }),
      etatLocalisation(),
      statistiquesCache(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="signature text-[26px] leading-tight text-encre">
          Sources de données
        </h1>
        <p className="mt-1 text-sm text-encre-2">
          Le catalogue du site se remplit de deux façons, qui cohabitent :
          l&apos;import d&apos;un fichier fourni par un organisme, et la liaison
          avec le backend de veille qui scrape les sites des organismes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="cadre p-4">
          <Nombre
            valeur={backendCounts}
            className="donnee block text-2xl text-encre"
          />
          <div className="text-sm text-encre-2">
            session(s) synchronisées depuis le backend
          </div>
        </div>
        <div className="cadre p-4">
          <Nombre
            valeur={manuelCounts}
            className="donnee block text-2xl text-encre"
          />
          <div className="text-sm text-encre-2">
            session(s) saisies ou importées à la main
          </div>
        </div>
      </div>

      <LiaisonBackend config={config} />

      <Localisation etat={etatGeo} cache={cacheGeo} />

      <div className="cadre p-6">
        <h2 className="signature text-[17px] text-encre">Import Excel / CSV</h2>
        <p className="mt-1 text-sm text-encre-2">
          Pour les organismes qui transmettent un fichier plutôt qu&apos;un
          planning en ligne. Les lignes importées portent la source « manuelle »
          et survivent aux synchronisations.
        </p>
        <Link
          href="/admin/import"
          className="mt-3 inline-block inline-flex items-center justify-center gap-2 rounded-[var(--rayon)] bg-surface-creuse px-4 py-2 text-sm font-medium text-encre transition-colors hover:bg-trait disabled:pointer-events-none disabled:opacity-40"
        >
          Ouvrir l&apos;assistant d&apos;import
        </Link>
      </div>

      <div className="cadre p-6">
        <h2 className="signature text-[17px] text-encre">
          Derniers passages de synchronisation
        </h2>
        {passages.length === 0 ? (
          <p className="mt-2 text-sm text-encre-2">
            Aucune synchronisation n&apos;a encore été lancée.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-trait text-left">
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
                    classe: "text-encre-2",
                  };
                  return (
                    <tr key={p.id} className="border-b border-trait align-top">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {horodatage.format(p.demarreLe)}
                      </td>
                      <td className="py-2 pr-4">{p.declencheur}</td>
                      <td className="py-2 pr-4">{p.mode}</td>
                      <td className={`py-2 pr-4 ${statut.classe}`}>
                        {statut.libelle}
                        {p.message && (
                          <div className="max-w-md text-xs text-encre-2">
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
