import { ImportWizard } from "@/components/admin/ImportWizard";

export default function AdminImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Import Excel / CSV
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Importez en masse des formations depuis un fichier fourni par un
          organisme partenaire.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
