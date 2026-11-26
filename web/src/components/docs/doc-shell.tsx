"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/*
 * The reading layout. Three columns on wide screens: section navigation, the content, and "On this page" for the
 * section you are reading. Two columns (navigation and content) on laptops, one on phones with a Contents menu.
 * The content is rendered by the server and passed in; only the highlighting runs in the browser.
 */

export type OutlineItem = { id: string; title: string; children?: readonly { id: string; title: string }[] };
export type OutlineGroup = { title: string; items: readonly OutlineItem[] };

export function DocShell({
  title,
  intro,
  outline,
  columns = 3,
  children,
}: {
  title: string;
  intro: ReactNode;
  outline: readonly OutlineGroup[];
  /** 3 adds the "On this page" column. */
  columns?: 2 | 3;
  children: ReactNode;
}) {
  const active = useActiveSection(outline);
  const current = outline.flatMap((group) => group.items).find((item) => item.id === active.section);

  return (
    <div className="mx-auto w-full max-w-wide px-4 pt-10 pb-24 sm:px-6 lg:px-10 lg:pt-14">
      <div
        className={cx(
          "grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12",
          columns === 3 && "xl:grid-cols-[230px_minmax(0,1fr)_200px]",
        )}
      >
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
          <details className="group rounded-lg border border-hairline lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-title-sm text-ink-strong [&::-webkit-details-marker]:hidden">
              Contents
              <ArrowDownIcon
                aria-hidden="true"
                className="shrink-0 text-ink-subtle group-open:rotate-180 motion-safe:transition-[rotate] motion-safe:duration-200"
              />
            </summary>
            <div className="border-t border-hairline px-2 py-3">
              <Navigation outline={outline} active={active.section} />
            </div>
          </details>
          <div className="hidden lg:block">
            <Navigation outline={outline} active={active.section} />
          </div>
        </aside>

        <article className="flex min-w-0 flex-col gap-10">
          <header className="flex flex-col gap-4 border-b border-hairline pb-10">
            <h1 className="display-fluid max-w-[18ch] text-ink-strong">{title}</h1>
            <div className="max-w-[68ch] text-body-lg text-pretty text-ink">{intro}</div>
          </header>
          {children}
        </article>

        {columns === 3 ? (
          <aside aria-label="On this page" className="hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100dvh-7rem)] xl:self-start xl:overflow-y-auto">
            {current?.children?.length ? (
              <>
                <p className="pb-3 text-label text-ink-strong">On this page</p>
                <ul className="flex flex-col gap-1 border-s border-hairline">
                  {current.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        aria-current={active.sub === child.id ? "location" : undefined}
                        className={cx(
                          "-ms-px block border-s py-1.5 ps-3 text-body-sm transition-[color,border-color] duration-150",
                          active.sub === child.id
                            ? "border-ink-strong text-ink-strong"
                            : "border-transparent text-ink-subtle hover:text-ink-strong",
                        )}
                      >
                        {child.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Navigation({ outline, active }: { outline: readonly OutlineGroup[]; active: string | undefined }) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-6">
      {outline.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-label text-ink-strong">{group.title}</p>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={active === item.id ? "location" : undefined}
                  className={cx(
                    "flex min-h-8 items-center rounded-md px-3 text-body-sm -outline-offset-2 pointer-coarse:min-h-11",
                    active === item.id ? "bg-surface-2 text-ink-strong" : "text-ink hover:bg-surface-2",
                  )}
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** The section and subsection nearest the top of the screen, below the floating navbar. */
function useActiveSection(outline: readonly OutlineGroup[]) {
  const [active, setActive] = useState<{ section?: string; sub?: string }>({});

  useEffect(() => {
    const items = outline.flatMap((group) => group.items);
    const ids = items.flatMap((item) => [item.id, ...(item.children ?? []).map((child) => child.id)]);
    const sectionOf = new Map<string, string>();
    for (const item of items) {
      sectionOf.set(item.id, item.id);
      for (const child of item.children ?? []) sectionOf.set(child.id, item.id);
    }
    const nodes = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    const update = () => {
      // The last heading that has passed the line 120px from the top is the one being read.
      let current = nodes[0]!;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= 120) current = node;
        else break;
      }
      const section = sectionOf.get(current.id);
      setActive({ section, sub: current.id === section ? undefined : current.id });
    };
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [outline]);

  return active;
}
