import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-[var(--rayon)] bg-action text-lg font-bold text-action-texte"
        >
          F
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Back office
          </h1>
          <p className="mt-1 text-sm text-encre-2">
            Réservé à l&apos;équipe PROINSEC.
          </p>
        </div>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
