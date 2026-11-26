"use client";

import Link from "next/link";
import { useRef } from "react";
import { SaldaLogo } from "@/components/brand";
import { IconButton } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-class";
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
        className="m-0 h-dvh max-h-none w-full max-w-none bg-canvas px-4 pb-[calc(16px+env(safe-area-inset-bottom))] text-ink open:flex open:flex-col"
      >
        <div className="flex h-14 shrink-0 items-center justify-between">
          <Link href="/" onClick={close} className="hit-44 flex items-center">
            <SaldaLogo />
          </Link>
          <IconButton label="Close menu" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>
        <nav aria-label="Page sections" className="flex-1 overflow-y-auto">
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
        <Link href="/app" onClick={close} className={buttonClass({ variant: "primary", size: "xl" })}>
          Open the app
        </Link>
      </dialog>
    </div>
  );
}
