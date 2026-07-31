import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { Marque } from "@/components/Marques";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 py-16">
      {/* La marque du site, nue. Pas une initiale dans une tuile pleine :
          un signe posé dans une boîte est un défaut de composant, pas une
          marque. */}
      <div className="flex flex-col gap-2">
        <Marque />
        <h1 className="signature text-[26px] leading-tight text-encre">
          Back office
        </h1>
        <p className="text-sm text-encre-2">
          Réservé à l&apos;équipe PROINSEC.
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
