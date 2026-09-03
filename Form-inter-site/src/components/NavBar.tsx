import Link from "next/link";

export function NavBar() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/formations" className="text-lg font-semibold tracking-tight">
          Formations Inter
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/formations" className="hover:text-zinc-500">
            Formations
          </Link>
          {/* La même recherche, prise par le lieu plutôt que par la liste. */}
          <Link href="/carte" className="hover:text-zinc-500">
            Carte
          </Link>
          <Link href="/organismes" className="hover:text-zinc-500">
            Organismes
          </Link>
          <Link
            href="/admin"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
