import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";

type SelectProps = Omit<ComponentProps<"select">, "className"> & {
  label: string;
  options: readonly { value: string; label: string }[];
  help?: string;
  error?: string;
  /** Places the label beside a 32px control, for toolbars. */
  compact?: boolean;
};

export function Select({ label, options, help, error, compact, id, ...props }: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  const note = error ?? help;

  return (
    <div className={cx("flex", compact ? "items-center gap-2" : "flex-col gap-2")}>
      <label htmlFor={selectId} className={compact ? "text-caption whitespace-nowrap text-ink-subtle" : "text-label text-ink-strong"}>
        {label}
      </label>
      <select
        id={selectId}
        className={cx(
          "min-w-0 rounded-control border bg-canvas text-ink hover:border-ink-subtle",
          error ? "border-danger" : "border-control-border",
          compact ? "min-h-8 px-2 text-body pointer-coarse:min-h-11 md:text-body-sm" : "min-h-10 w-full px-3 text-body pointer-coarse:min-h-11 md:text-body-sm",
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${selectId}-note` : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {note ? (
        <p id={`${selectId}-note`} className={cx("text-caption", error ? "text-on-danger" : "text-ink-subtle")}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
