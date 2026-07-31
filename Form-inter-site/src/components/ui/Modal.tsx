"use client";

import { useEffect, useRef } from "react";

/**
 * Fenêtre modale. Au-delà du style, elle gère le clavier : le focus entre dans
 * le panneau à l'ouverture, y reste tant qu'elle est ouverte, et revient à
 * l'élément d'origine à la fermeture. Sans ça, refermer une fiche renvoyait le
 * focus en haut de page et faisait perdre sa place dans une liste de deux
 * cents cartes.
 */
export function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null;
    panneau.current?.focus();

    function auClavier(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panneau.current) return;

      const focusables = panneau.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", auClavier);
    const debordementInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = debordementInitial;
      origine?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(12_20_28/0.55)] backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* Sur mobile la fiche monte du bas et occupe toute la largeur ; sur
          grand écran c'est une carte centrée. */}
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-bordure bg-surface shadow-flottant outline-none sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
