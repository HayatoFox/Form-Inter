import { ImportWizard } from "@/components/admin/ImportWizard";

export default function AdminImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="signature text-[26px] leading-tight text-encre">
          Import Excel / CSV
        </h1>
        <p className="mt-1 text-sm text-encre-2">
          Importez en masse des formations depuis un fichier fourni par un
          organisme partenaire.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
