import type { Metadata } from "next";
import localFont from "next/font/local";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

/**
 * Gambarino porte la signature, et rien d'autre : la marque, les titres, les
 * grands nombres. C'est un romain étroit à approches creusées, dessiné pour
 * l'impression contrainte — le registre exact d'un catalogue de formations
 * réglementaires bourré de codes (R489, B1V-B2V, SSIAP, CATEC). Il est
 * auto-hébergé, pas tiré de l'étagère Google.
 *
 * Le corps reste en system-ui et les données en chasse fixe système : deux
 * neutres véritables, qui ne cherchent pas à avoir une voix.
 */
const gambarino = localFont({
  src: "../fonts/gambarino-regular.woff2",
  variable: "--font-gambarino",
  weight: "400",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Formations Inter",
    template: "%s · Formations Inter",
  },
  description:
    "Le calendrier des sessions de formation inter-entreprises des organismes partenaires, relevé chaque nuit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${gambarino.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NavBar />
        <main className="mx-auto w-full max-w-[78rem] flex-1 px-5 py-8 sm:px-8">
          {children}
        </main>
        <Colophon />
      </body>
    </html>
  );
}

/**
 * Le pied de page ne reprend pas le gabarit habituel — gros logo, quatre
 * colonnes de liens, filet, ligne de copyright : il n'y a rien à mettre dans
 * ces colonnes. Il y a une ligne de provenance, et une signature.
 *
 * La signature est composée, pas déposée là pour cocher la case : « Proinsec »
 * en Gambarino, dimensionné pour tenir exactement la mesure du contenu, posé
 * au ras du bord inférieur de la page, sans blanc dessous.
 *
 * L'interligne n'est pas choisi à l'œil. Gambarino mesure 1,08 em de montante
 * et 0,31 em de descendante ; les hauts de lettres de ce mot montent à 0,76 em
 * au-dessus de la ligne de base et les panses rondes descendent 0,02 em en
 * dessous. Avec un interligne L, la ligne de base tombe à (L − 1,39)/2 + 1,08
 * du haut du bloc. À 0,83 l'encre tient entre 0,04 em et 0,82 em : trois
 * pixels de marge en bas, treize en haut, aucune lettre entamée. À 0,74,
 * l'interligne d'avant, le bas des lettres était rogné de onze pixels — une
 * signature coupée n'est pas une signature.
 *
 * Il est en `--trait-fort`, une valeur, pas de l'encre : on le lit comme une
 * empreinte du papier, pas comme un titre.
 */
function Colophon() {
  return (
    <footer className="mt-16">
      <div className="mx-auto w-full max-w-[78rem] px-5 sm:px-8">
        <p className="border-t border-trait pt-4 text-sm text-encre-3">
          Relevé chaque nuit chez les organismes partenaires, à deux heures du
          matin. Un outil interne PROINSEC.
        </p>
      </div>
      <div className="mx-auto mt-10 w-full max-w-[78rem] overflow-hidden px-5 sm:px-8">
        <p
          aria-hidden="true"
          className="signature block leading-[0.83] text-[clamp(3.2rem,22.9vw,20.65rem)] tracking-[-0.02em] text-trait-fort select-none"
        >
          Proinsec
        </p>
      </div>
    </footer>
  );
}
