"use client";

import * as Dialog from "@radix-ui/react-dialog";

/**
 * Boîte de dialogue du back office, art-dirigée par-dessus la primitive Radix.
 * Le comportement clavier et le piège à focus viennent de la bibliothèque : une
 * version faite maison serait forcément moins bonne.
 */
export function Dialogue({
  ouvert,
  onFermer,
  titre,
  description,
  children,
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--encre)_45%,transparent)]" />
        <Dialog.Content className="cadre fixed top-1/2 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5 outline-none">
          <Dialog.Title className="signature text-[20px] leading-tight text-encre">
            {titre}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1.5 text-sm text-encre-2">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
