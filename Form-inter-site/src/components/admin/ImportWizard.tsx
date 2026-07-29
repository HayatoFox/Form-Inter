"use client";

import { useMemo, useState } from "react";
import {
  applyMapping,
  guessMapping,
  IMPORT_TARGET_FIELDS,
  type ImportTargetField,
} from "@/lib/importMapping";
import { importRowSchema } from "@/lib/validation";

type Step = "upload" | "map" | "preview" | "result";

type CommitResult = {
  total: number;
  processed: number;
  sessionsCreated: number;
  errors: { row: number; message: string }[];
};

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportTargetField | "">>(
    {}
  );
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  const mappedRows = useMemo(
    () => rawRows.map((row) => applyMapping(row, mapping)),
    [rawRows, mapping]
  );

  const previewResults = useMemo(
    () =>
      mappedRows.map((row) => {
        const parsed = importRowSchema.safeParse(row);
        return parsed.success
          ? { ok: true as const, row }
          : {
              ok: false as const,
              row,
              message: parsed.error.issues.map((i) => i.message).join(", "),
            };
      }),
    [mappedRows]
  );

  const validCount = previewResults.filter((r) => r.ok).length;
  const hasOrganisme = Object.values(mapping).includes("organisme");
  const hasIntitule = Object.values(mapping).includes("intitule");

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Veuillez sélectionner un fichier");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/import/parse", {
      method: "POST",
      body: formData,
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur lors de la lecture du fichier");
      return;
    }

    const data = await res.json();
    setHeaders(data.headers);
    setRawRows(data.rows);
    setMapping(guessMapping(data.headers));
    setStep("map");
  }

  async function handleCommit() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: mappedRows }),
    });
    setLoading(false);

    if (!res.ok) {
      setError("Erreur lors de l'import");
      return;
    }

    const data: CommitResult = await res.json();
    setCommitResult(data);
    setStep("result");
  }

  function reset() {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setCommitResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-sm">
        {(["upload", "map", "preview", "result"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-2 ${
              step === s ? "font-semibold" : "text-zinc-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                step === s
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {i + 1}
            </span>
            {s === "upload" && "Fichier"}
            {s === "map" && "Mapping"}
            {s === "preview" && "Aperçu"}
            {s === "result" && "Résultat"}
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {step === "upload" && (
        <form
          onSubmit={handleUpload}
          className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-sm text-zinc-500">
            Sélectionnez un fichier Excel (.xlsx) ou CSV contenant les
            formations à importer. La première ligne doit contenir les
            en-têtes de colonnes.
          </p>
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls,.csv"
            required
            className="text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Analyse…" : "Analyser le fichier"}
          </button>
        </form>
      )}

      {step === "map" && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            Associez chaque colonne détectée à un champ. Organisme et Intitulé
            sont requis.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4">Colonne du fichier</th>
                <th className="py-2 pr-4">Exemple</th>
                <th className="py-2">Champ cible</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header) => (
                <tr key={header} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4 font-medium">{header}</td>
                  <td className="py-2 pr-4 text-zinc-500">
                    {String(rawRows[0]?.[header] ?? "")}
                  </td>
                  <td className="py-2">
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [header]: e.target.value as ImportTargetField | "",
                        }))
                      }
                      className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      <option value="">Ignorer</option>
                      {IMPORT_TARGET_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!hasOrganisme || !hasIntitule) && (
            <p className="text-sm text-amber-600">
              Il faut associer au moins une colonne à &quot;Organisme&quot; et
              une colonne à &quot;Intitulé de la formation&quot;.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("preview")}
              disabled={!hasOrganisme || !hasIntitule}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Continuer
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Recommencer
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            {validCount} ligne{validCount > 1 ? "s" : ""} valide
            {validCount > 1 ? "s" : ""} sur {previewResults.length}.
          </p>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Organisme</th>
                  <th className="py-2 pr-4">Intitulé</th>
                  <th className="py-2">Détail</th>
                </tr>
              </thead>
              <tbody>
                {previewResults.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-4 text-zinc-500">{i + 1}</td>
                    <td className="py-2 pr-4">
                      {r.ok ? (
                        <span className="text-emerald-600">OK</span>
                      ) : (
                        <span className="text-red-600">Erreur</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{String(r.row.organisme ?? "")}</td>
                    <td className="py-2 pr-4">{String(r.row.intitule ?? "")}</td>
                    <td className="py-2 text-zinc-500">
                      {!r.ok && r.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewResults.length > 200 && (
              <p className="mt-2 text-xs text-zinc-500">
                Aperçu limité aux 200 premières lignes ({previewResults.length}{" "}
                au total seront importées).
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              disabled={loading || validCount === 0}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Import en cours…" : `Importer ${validCount} ligne(s)`}
            </button>
            <button
              onClick={() => setStep("map")}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Retour au mapping
            </button>
          </div>
        </div>
      )}

      {step === "result" && commitResult && (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm">
            <span className="font-semibold text-emerald-600">
              {commitResult.processed}
            </span>{" "}
            ligne{commitResult.processed > 1 ? "s" : ""} traitée
            {commitResult.processed > 1 ? "s" : ""} sur {commitResult.total}{" "}
            (dont {commitResult.sessionsCreated} nouvelle
            {commitResult.sessionsCreated > 1 ? "s" : ""} session
            {commitResult.sessionsCreated > 1 ? "s" : ""}).
          </p>

          {commitResult.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-600">
                {commitResult.errors.length} erreur
                {commitResult.errors.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-500">
                {commitResult.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    Ligne {e.row} : {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={reset}
            className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
