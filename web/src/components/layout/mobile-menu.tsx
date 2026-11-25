"use client";

import { useRef } from "react";
import { IconButton } from "@/components/ui/button";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/** Full-height sheet. A native dialog, so Escape closes it and focus returns to the button. */
export function MobileMenu({ links }: { links: readonly { href: string; label: string }[] }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const close = () => sheet.current?.close();

  return (
    <div className="md:hidden">
      <IconButton label="Open menu" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
        <MenuIcon />
      </IconButton>
      <dialog
        ref={sheet}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-canvas px-4 pb-[env(safe-area-inset-bottom)] text-ink"
      >
        <div className="flex h-14 items-center justify-end">
          <IconButton label="Close menu" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>
        <nav aria-label="Page sections">
          <ul>
            {links.map((link) => (
              <li key={link.href} className="border-t border-hairline">
                <a href={link.href} onClick={close} className="flex min-h-14 items-center text-title-lg text-ink-strong">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </div>
  );
}
