import type { ReactNode } from "react";
import { AlertIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/*
 * Reading styles for /docs, /privacy and /terms. Body text keeps to a 68ch measure; tables and code may run
 * wider and scroll sideways inside a focusable region.
 */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="group pt-4 text-title-lg text-balance text-ink-strong lg:text-headline">
      <a href={`#${id}`} className="rounded-sm no-underline">
        {children}
        <span aria-hidden="true" className="ps-2 text-ink-subtle opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          #
        </span>
      </a>
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="pt-6 text-title text-balance text-ink-strong">
      {children}
    </h3>
  );
}

export function P({ children, lead }: { children: ReactNode; lead?: boolean }) {
  return <p className={cx("max-w-measure text-pretty", lead ? "text-body-lg text-ink" : "text-body text-ink")}>{children}</p>;
}

export function List({ children, ordered }: { children: ReactNode; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cx("flex max-w-measure flex-col gap-2 ps-5 text-body text-ink", ordered ? "list-decimal" : "list-disc")}>
      {children}
    </Tag>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-xs bg-surface-2 px-1 py-0.5 font-mono text-body-sm text-ink-strong">{children}</code>;
}

export function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-label text-ink-subtle">{label}</figcaption>
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto rounded-lg bg-inverse p-4 font-mono text-body-sm text-on-inverse -outline-offset-2"
      >
        <code>{children.trim()}</code>
      </pre>
    </figure>
  );
}

export function Table({ caption, head, rows }: { caption: string; head: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return (
    <div tabIndex={0} role="region" aria-label={caption} className="overflow-x-auto rounded-lg border border-hairline -outline-offset-2">
      <table className="w-full min-w-[520px] text-body-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline bg-surface text-label text-ink-subtle">
            {head.map((cell) => (
              <th key={cell} scope="col" className="h-10 px-3 text-start font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-hairline align-top last:border-b-0">
              {row.map((cell, column) =>
                column === 0 ? (
                  <th key={column} scope="row" className="px-3 py-2.5 text-start font-normal text-ink-strong">
                    {cell}
                  </th>
                ) : (
                  <td key={column} className="px-3 py-2.5 text-ink">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex max-w-measure gap-3 rounded-lg bg-info-fill p-4 text-body-sm text-on-info">
      <AlertIcon className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </aside>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      rel={external ? "noopener" : undefined}
      className="text-link underline underline-offset-4 hover:text-primary-hover"
    >
      {children}
    </a>
  );
}

/** One top-level section: its h2, then its body. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-hairline pt-8 first:border-t-0 first:pt-0">
      <H2 id={id}>{title}</H2>
      {children}
    </section>
  );
}
