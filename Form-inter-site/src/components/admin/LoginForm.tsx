"use client";

import { startTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { action, cadre, champ, legende } from "@/lib/ui";

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
    const cible = from && from.startsWith("/admin") ? from : "/admin";

    // On vide le cache de route AVANT de naviguer, et on attend que ce soit
    // fait. Sans cela, `push` réutilise la réponse mise en cache quand on
    // n'était pas connecté — c'est-à-dire la redirection vers cette page — et
    // le bouton « Se connecter » renvoie à l'écran de connexion alors que le
    // cookie est bien posé.
    router.refresh();
    startTransition(() => router.push(cible));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${cadre} flex flex-col gap-4 p-6`}
    >
      <div>
        <label htmlFor="email" className={legende}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${champ} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor="password" className={legende}>
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${champ} mt-1.5`}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-[var(--rayon)] bg-erreur-doux px-4 py-2.5 text-sm text-erreur shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--erreur)_25%,transparent)]"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className={action}
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
