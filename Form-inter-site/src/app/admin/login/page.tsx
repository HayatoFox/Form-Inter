import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">
        Connexion administrateur
      </h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
