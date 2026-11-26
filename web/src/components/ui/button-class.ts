import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

/*
 * One button system for every page. Every button is a pill, and the size says where it sits:
 *   xl  48px  marketing calls to action (landing page, mobile menu)
 *   lg  40px  the main action of a step, panel or dialog
 *   md  32px  page-header and toolbar actions
 *   sm  28px  actions inside a row or list
 *   xs  24px  chips
 * Use one primary (filled) button per view. Every size grows to a 44px touch area on touch screens.
 */

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-hairline-strong bg-canvas text-ink-strong hover:bg-surface-2",
  ghost: "text-ink-strong hover:bg-surface-2",
  inverse: "bg-inverse text-on-inverse hover:bg-inverse-hover",
  danger: "bg-danger text-on-primary hover:bg-on-danger",
  link: "text-link underline-offset-4 hover:text-primary-hover hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  xs: "min-h-6 px-2.5 py-0.5 text-label-sm",
  sm: "min-h-7 px-3 py-1 text-button",
  md: "min-h-8 px-4 py-1 text-button",
  lg: "min-h-10 px-5 py-2 text-button-lg",
  xl: "min-h-12 px-6 py-3 text-button-lg",
};

// The icon side gets 2px less padding so the button looks balanced.
const iconSide: Record<ButtonSize, string> = {
  xs: "ps-2",
  sm: "ps-2.5",
  md: "ps-3.5",
  lg: "ps-4.5",
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
    "hit-44 inline-flex items-center justify-center gap-1.5 rounded-full text-center select-none",
    "transition-[scale,background-color,color] duration-150 ease-out motion-safe:active:scale-97",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none",
    variants[variant],
    sizes[size],
    withIcon && iconSide[size],
  );
}
