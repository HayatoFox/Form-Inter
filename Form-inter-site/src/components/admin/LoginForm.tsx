"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Une erreur est survenue");
      return;
    }

    const from = searchParams.get("from");
    router.push(from && from.startsWith("/admin") ? from : "/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-bordure bg-surface shadow-carte p-6"
    >
      <div>
        <label htmlFor="email" className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-medium tracking-wide text-texte-doux uppercase">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-tenu transition-colors hover:border-bordure-forte"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-erreur/30 bg-erreur-fond px-4 py-2.5 text-sm text-erreur"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 bg-action text-action-texte hover:bg-action-survol"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
