import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { CheckIcon } from "./icons";

type NativeProps = Omit<ComponentProps<"input">, "className" | "type" | "children">;
type ChoiceProps = NativeProps & { label: string; description?: string };

// The whole row is the hit area: 32px with a mouse, 44px on touch.
const row = "flex min-h-8 cursor-pointer items-start gap-2 py-1.5 pointer-coarse:min-h-11 pointer-coarse:py-3";

function ChoiceText({ label, description }: { label: string; description?: string }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-body-sm text-ink">{label}</span>
      {description ? <span className="text-caption text-ink-subtle">{description}</span> : null}
    </span>
  );
}

export function Checkbox({ label, description, ...props }: ChoiceProps) {
  return (
    <label className={row}>
      <span className="relative mt-0.5 size-4 shrink-0">
        <input
          type="checkbox"
          className="peer size-4 appearance-none rounded-xs border border-control-border bg-canvas checked:border-primary checked:bg-primary disabled:opacity-50 forced-colors:appearance-auto"
          {...props}
        />
        <CheckIcon
          strokeWidth="2"
          className="pointer-events-none absolute inset-0 hidden text-on-primary peer-checked:block forced-colors:peer-checked:hidden"
        />
      </span>
      <ChoiceText label={label} description={description} />
    </label>
  );
}

export function Radio({ label, description, ...props }: ChoiceProps) {
  return (
    <label className={row}>
      <span className="relative mt-0.5 size-4 shrink-0">
        <input
          type="radio"
          className="peer size-4 appearance-none rounded-full border border-control-border bg-canvas checked:border-primary checked:bg-primary disabled:opacity-50 forced-colors:appearance-auto"
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 m-auto hidden size-1.5 rounded-full bg-on-primary peer-checked:block forced-colors:peer-checked:hidden" />
      </span>
      <ChoiceText label={label} description={description} />
    </label>
  );
}

/** Label it with what turning it on does. */
export function Switch({ label, description, ...props }: ChoiceProps) {
  return (
    <label className={cx(row, "justify-between gap-4")}>
      <ChoiceText label={label} description={description} />
      <span className="relative mt-0.5 h-3.5 w-6 shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer block h-3.5 w-6 appearance-none rounded-full bg-control-border transition-[background-color] duration-150 ease-standard checked:bg-primary disabled:opacity-50 forced-colors:appearance-auto"
          {...props}
        />
        <span className="pointer-events-none absolute start-0.5 top-0.5 size-2.5 rounded-full bg-canvas peer-checked:translate-x-2.5 motion-safe:transition-[translate] motion-safe:duration-150 motion-safe:ease-out forced-colors:hidden" />
      </span>
    </label>
  );
}

export function ChoiceGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="pb-1 text-label text-ink-strong">{legend}</legend>
      {children}
    </fieldset>
  );
}

type SegmentedProps = { legend: string; options: readonly string[] } & (
  | { defaultValue: string; value?: undefined; onValueChange?: undefined }
  | { value: string; onValueChange: (value: string) => void; defaultValue?: undefined }
);

export function Segmented({ legend, options, defaultValue, value, onValueChange }: SegmentedProps) {
  const name = useId();

  return (
    <fieldset>
      <legend className="pb-2 text-label text-ink-strong">{legend}</legend>
      <div className="inline-flex rounded-control bg-surface-2 p-0.5">
        {options.map((option) => (
          <label key={option} className="hit-44">
            <input
              type="radio"
              name={name}
              value={option}
              {...(onValueChange
                ? { checked: option === value, onChange: () => onValueChange(option) }
                : { defaultChecked: option === defaultValue })}
              className="peer sr-only"
            />
            <span className="flex min-h-7 cursor-pointer items-center rounded-md px-3 text-button text-ink-subtle hover:text-ink-strong peer-checked:bg-canvas peer-checked:text-ink-strong peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              {option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
