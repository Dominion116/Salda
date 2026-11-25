"use client";

import { CopyIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

export function Swatch({ name, hex, use, note }: { name: string; hex: string; use: string; note?: string }) {
  const show = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      show({ tone: "success", message: `Copied ${hex}` });
    } catch {
      show({ tone: "error", message: `Unable to copy ${hex}. Select the value and copy it instead.` });
    }
  };

  return (
    <div className="flex items-center gap-4 border-t border-hairline py-3">
      <span
        aria-hidden="true"
        className="size-12 shrink-0 rounded-lg shadow-ring"
        style={{ background: `var(--color-${name})` }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-title-sm text-ink-strong">{name}</span>
        <span className="text-body-sm text-ink-subtle">{use}</span>
        {note ? <span className="text-caption text-ink tabular-nums">{note}</span> : null}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${name}, ${hex}`}
        className="hit-44 inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-control px-2 font-mono text-mono text-ink-subtle transition-[scale,background-color,color] duration-150 ease-out hover:bg-surface-2 hover:text-ink-strong motion-safe:active:scale-97"
      >
        {hex}
        <CopyIcon />
      </button>
    </div>
  );
}
