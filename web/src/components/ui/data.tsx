import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { AlertIcon } from "./icons";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-fill text-on-success",
  warning: "bg-warning-fill text-on-warning",
  danger: "bg-danger-fill text-on-danger",
  info: "bg-info-fill text-on-info",
  neutral: "bg-surface-2 text-ink",
};

export function Badge({ tone = "neutral", dot, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 rounded-sm px-2 text-label-sm whitespace-nowrap", tones[tone])}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-hairline bg-surface px-1 font-sans text-label-sm text-ink-subtle">
      {children}
    </kbd>
  );
}

/** An amount with its unit one step quieter, always tabular. */
export function Amount({ value, unit = "tUSD8" }: { value: string; unit?: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-ink-strong">{value}</span>
      <span className="text-ink-subtle">{" "}{unit}</span>
    </span>
  );
}

export function Panel({
  title,
  description,
  heading: Heading = "h4",
  action,
  children,
}: {
  title?: string;
  description?: string;
  heading?: "h2" | "h3" | "h4";
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-canvas p-5 shadow-ring">
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Heading className="text-title-sm text-ink-strong">{title}</Heading>
            {description ? <p className="text-body-sm text-ink-subtle">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-title-sm text-ink-strong">{title}</p>
        <p className="max-w-[40ch] text-body-sm text-pretty text-ink-subtle">{children}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      <AlertIcon width={24} height={24} className="text-on-danger" />
      <div className="flex flex-col gap-1">
        <p className="text-title-sm text-ink-strong">{title}</p>
        <p className="max-w-[40ch] text-body-sm text-pretty text-ink-subtle">{children}</p>
      </div>
      {action}
    </div>
  );
}

export function LoadingRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex h-10 items-center justify-between border-b border-hairline px-3 last:border-b-0">
            <span className="skeleton h-3 w-32 rounded-xs" />
            <span className="skeleton h-3 w-16 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}
