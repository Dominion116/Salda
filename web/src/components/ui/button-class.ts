import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-hairline-strong bg-canvas text-ink-strong hover:bg-surface-2",
  ghost: "text-ink-strong hover:bg-surface-2",
  inverse: "bg-inverse text-on-inverse hover:bg-inverse-hover",
  danger: "bg-danger text-on-primary hover:bg-on-danger",
  link: "text-link underline-offset-4 hover:text-primary-hover hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  xs: "min-h-6 rounded-sm px-2 py-0.5 text-label-sm",
  sm: "min-h-7 rounded-md px-3 py-1 text-button",
  md: "min-h-8 rounded-control px-3 py-1 text-button",
  lg: "min-h-10 rounded-control px-4 py-2 text-body-sm font-medium",
  xl: "min-h-12 rounded-full px-6 py-3 text-button-lg",
};

// The icon side gets 2px less padding so the button looks balanced.
const iconSide: Record<ButtonSize, string> = {
  xs: "ps-1.5",
  sm: "ps-2.5",
  md: "ps-2.5",
  lg: "ps-3.5",
  xl: "ps-5.5",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  withIcon = false,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  withIcon?: boolean;
} = {}) {
  return cx(
    "hit-44 inline-flex items-center justify-center gap-1.5 text-center select-none",
    "transition-[scale,background-color,color] duration-150 ease-out motion-safe:active:scale-97",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none",
    variants[variant],
    sizes[size],
    withIcon && iconSide[size],
  );
}
