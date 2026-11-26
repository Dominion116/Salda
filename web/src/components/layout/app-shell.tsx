import Link from "next/link";
import type { ReactNode } from "react";
import { SaldaLogo } from "@/components/brand";
import { Badge } from "@/components/ui/data";
import { cx } from "@/lib/cx";

export type AppNavItem = { href: string; label: string; count?: number; current?: boolean };

function NavItem({ item }: { item: AppNavItem }) {
  return (
    <Link
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      className={cx(
        "flex min-h-8 items-center gap-2 rounded-md px-2 text-body-sm whitespace-nowrap -outline-offset-2 pointer-coarse:min-h-11",
        item.current ? "bg-surface-2 text-ink-strong" : "text-ink hover:bg-surface-2",
      )}
    >
      {item.label}
      {item.count ? (
        <span className="ms-auto text-ink-subtle tabular-nums">
          {item.count}
          <span className="sr-only"> need you</span>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The app frame: a 240px sidebar beside the content, or a scrolling row of links above it when
 * the frame is narrower than 768px. It measures its own width, not the window's.
 */
export function AppShell({
  nav,
  secondary = [],
  title,
  mode,
  actions,
  banner,
  fill,
  children,
}: {
  nav: readonly AppNavItem[];
  secondary?: readonly AppNavItem[];
  title: ReactNode;
  mode: "sample" | "live";
  actions?: ReactNode;
  banner?: ReactNode;
  /** Takes the full height of the window. */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="@container">
      <div className={cx("flex flex-col @min-[768px]:flex-row", fill && "min-h-dvh")}>
        <div
          className={cx(
            "flex min-w-0 shrink-0 flex-col border-b border-hairline bg-surface @min-[768px]:w-60 @min-[768px]:border-e @min-[768px]:border-b-0",
            fill && "@min-[768px]:sticky @min-[768px]:top-0 @min-[768px]:h-dvh @min-[768px]:overflow-y-auto",
          )}
        >
          <Link href="/" className="hit-44 flex h-14 shrink-0 items-center px-4 -outline-offset-2">
            <SaldaLogo />
          </Link>
          <nav aria-label="App" className="flex flex-1 overflow-x-auto px-2 pb-2 @min-[768px]:flex-col @min-[768px]:justify-between">
            <ul className="flex gap-1 @min-[768px]:flex-col">
              {nav.map((item) => (
                <li key={item.label} className="shrink-0">
                  <NavItem item={item} />
                </li>
              ))}
            </ul>
            {secondary.length > 0 ? (
              <ul className="flex gap-1 ps-1 @min-[768px]:flex-col @min-[768px]:ps-0">
                {secondary.map((item) => (
                  <li key={item.label} className="shrink-0">
                    <NavItem item={item} />
                  </li>
                ))}
              </ul>
            ) : null}
          </nav>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-hairline px-4 py-2 @min-[768px]:px-6">
            <p className="text-title-sm text-ink-strong">{title}</p>
            {mode === "sample" ? <Badge tone="info">Sample data</Badge> : null}
            {actions ? <div className="ms-auto flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
          {banner}
          {children}
        </div>
      </div>
    </div>
  );
}
