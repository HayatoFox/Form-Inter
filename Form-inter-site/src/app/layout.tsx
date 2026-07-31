import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Formations Inter",
    template: "%s · Formations Inter",
  },
  description:
    "Catalogue des sessions de formation inter-entreprises des organismes partenaires : domaine, ville, dates, tarifs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NavBar />
        {/* Large : l'écran de recherche est balayé toute la journée, chaque
            colonne gagnée est une session de plus visible sans défiler. */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-7xl px-4 py-8 text-xs text-texte-tenu sm:px-6">
          Formations Inter — veille des sessions inter-entreprises, PROINSEC.
        </footer>
      </body>
    </html>
  );
}
