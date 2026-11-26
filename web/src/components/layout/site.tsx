import Link from "next/link";
import type { ReactNode } from "react";
import { SaldaLogo } from "@/components/brand";
import { Reveal } from "@/components/motion/motion";
import { Letters } from "@/components/motion/words";
import { buttonClass } from "@/components/ui/button-class";
import { Badge } from "@/components/ui/data";
import { cx } from "@/lib/cx";
import { MobileMenu } from "./mobile-menu";
import { SkipLink } from "./skip-link";

export const container = "mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10";

export const siteLinks = [
  { href: "#clearing", label: "Clearing" },
  { href: "#who", label: "Who it’s for" },
  { href: "#safety", label: "Safety" },
  { href: "#steps", label: "Steps" },
  { href: "#limits", label: "Limits" },
] as const;

/**
 * A floating glass pill. It is chrome over moving content, so glass is allowed here (design.md); the
 * `glass-pill` class falls back to a solid surface for reduced transparency and forced colors.
 */
function SiteHeader() {
  return (
    <header className="pointer-events-none sticky top-0 z-(--z-sticky) px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={cx(
          "glass-pill pointer-events-auto relative mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 rounded-full ps-5 pe-2",
          "md:grid md:grid-cols-[1fr_auto_1fr]",
        )}
      >
        <Link href="/" className="hit-44 flex items-center justify-self-start rounded-full">
          <SaldaLogo priority />
        </Link>
        <nav aria-label="Page sections" className="hidden md:block">
          <ul className="flex items-center">
            {siteLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="flex h-11 items-center rounded-full px-3 text-body-sm whitespace-nowrap text-ink transition-[color] duration-150 ease-standard hover:text-ink-strong lg:px-4"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2 justify-self-end">
          <span className="max-sm:hidden">
            <Badge>Testnet</Badge>
          </span>
          <Link href="/app" className={buttonClass({ size: "lg", pill: true })}>
            Open the app
          </Link>
          <MobileMenu links={siteLinks} />
        </div>
        <span aria-hidden="true" className="scroll-progress" />
      </div>
    </header>
  );
}

function SiteFooter() {
  const linkClass = "hit-44 inline-flex min-h-6 items-center text-body-sm text-ink-subtle underline-offset-4 hover:text-ink-strong hover:underline";

  return (
    <footer className="overflow-hidden border-t border-hairline">
      <div className={cx(container, "grid gap-12 py-16 md:grid-cols-12 md:gap-6")}>
        <div className="flex flex-col gap-2 md:col-span-6">
          <p className="text-title text-ink-strong">Salda</p>
          <p className="max-w-[36ch] text-body-sm text-pretty text-ink-subtle">
            Clears what a group of businesses owe each other with the least cash.
          </p>
        </div>
        <nav aria-label="On this page" className="md:col-span-3">
          <h2 className="pb-4 text-body-sm font-medium text-ink-strong">On this page</h2>
          <ul className="flex flex-col gap-3 pointer-coarse:gap-5">
            {siteLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Project" className="md:col-span-3">
          <h2 className="pb-4 text-body-sm font-medium text-ink-strong">Project</h2>
          <ul className="flex flex-col gap-3 pointer-coarse:gap-5">
            <li>
              <Link href="/demo" className={linkClass}>Try the demo</Link>
            </li>
            <li>
              <Link href="/app" className={linkClass}>Open the app</Link>
            </li>
            <li>
              <Link href="/design" className={linkClass}>Design system</Link>
            </li>
            <li>
              <a href="https://explorer-test.qday.info" rel="noopener" className={linkClass}>Aevum testnet explorer</a>
            </li>
            <li>
              <a href="https://arxiv.org/abs/2507.22309" rel="noopener" className={linkClass}>Cycles Protocol paper</a>
            </li>
          </ul>
        </nav>
      </div>
      <div className={cx(container, "flex flex-wrap items-center justify-between gap-4 border-t border-hairline py-6 text-body-sm text-ink-subtle")}>
        <p>Test tokens only. Nothing here is financial advice.</p>
        <a href="#main" className={linkClass}>Back to the top</a>
      </div>
      <Reveal
        as="p"
        variant="letters"
        aria-hidden="true"
        className="wordmark pointer-events-none -mb-[0.06em] text-center text-hairline select-none"
      >
        <Letters text="Salda" />
      </Reveal>
    </footer>
  );
}

/** Two hairline rails that run the length of the page, behind the content. */
function Rails() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      <div className={cx(container, "h-full")}>
        <div className="rail mx-auto h-full w-1/2 border-x border-hairline" />
      </div>
    </div>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <div className="relative">
        <Rails />
        <main id="main" tabIndex={-1} className="relative">
          {children}
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
