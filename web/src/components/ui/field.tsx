import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { AlertIcon } from "./icons";

type FieldProps = Omit<ComponentProps<"input">, "className" | "prefix" | "size"> & {
  label: string;
  help?: string;
  error?: string;
  /** Shown inside the border, before or after the value. */
  prefix?: ReactNode;
  suffix?: ReactNode;
  numeric?: boolean;
};

/** A 40px form field: label above, help or error below, 16px text on phones. */
export function Field({ label, help, error, prefix, suffix, numeric, id, ...props }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const noteId = `${inputId}-note`;
  const note = error ?? help;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-label text-ink-strong">
        {label}
      </label>
      <div
        className={cx(
          "flex min-h-10 items-center gap-2 rounded-control border bg-canvas px-3",
          "transition-[border-color] duration-150 ease-standard",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
          error ? "border-danger" : "border-control-border hover:border-ink-subtle",
        )}
      >
        {prefix ? <span className="shrink-0 text-body-sm text-ink-subtle">{prefix}</span> : null}
        <input
          id={inputId}
          className={cx(
            "min-w-0 flex-1 bg-transparent py-2 text-body text-ink outline-none placeholder:text-ink-subtle md:text-body-sm",
            numeric && "text-end tabular-nums",
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...props}
        />
        {suffix ? <span className="shrink-0 text-body-sm text-ink-subtle">{suffix}</span> : null}
      </div>
      {note ? (
        <p
          id={noteId}
          className={cx("flex items-start gap-1.5 text-caption", error ? "text-on-danger" : "text-ink-subtle")}
        >
          {error ? <AlertIcon className="shrink-0" /> : null}
          {note}
        </p>
      ) : null}
    </div>
  );
}
