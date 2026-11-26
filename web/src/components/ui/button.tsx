import type { ComponentProps, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";
import { SpinnerIcon } from "./icons";

// A spinner replaces the leading icon, so a button that can load must have one.
type IconProps = { icon: ReactNode; loading?: boolean } | { icon?: undefined; loading?: undefined };

type ButtonProps = Omit<ComponentProps<"button">, "className"> &
  IconProps & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({
  variant,
  size,
  icon,
  loading,
  type = "button",
  onClick,
  children,
  ...props
}: ButtonProps) {
  // While loading, the button keeps focus but can't submit or run its action again.
  return (
    <button
      {...props}
      type={loading ? "button" : type}
      className={buttonClass({ variant, size, withIcon: icon !== undefined })}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? undefined : onClick}
    >
      {loading ? <SpinnerIcon className="shrink-0" /> : icon}
      {children}
    </button>
  );
}

type IconButtonProps = Omit<ComponentProps<"button">, "className" | "aria-label"> & { label: string };

export function IconButton({ label, type = "button", children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className="hit-44 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-[scale,background-color,color] duration-150 ease-out hover:bg-surface-2 hover:text-ink-strong motion-safe:active:scale-97"
      {...props}
    >
      {children}
    </button>
  );
}
