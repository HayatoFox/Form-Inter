import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Trouvez une formation inter-entreprises
      </h1>
      <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
        Recherchez et filtrez les formations proposées par nos organismes de
        formation partenaires en France : domaine, ville, dates et bien plus.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/formations"
          className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Rechercher une formation
        </Link>
        <Link
          href="/organismes"
          className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Voir les organismes partenaires
        </Link>
      </div>
    </div>
  );
}
