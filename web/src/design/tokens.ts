/*
 * The same tokens as src/app/tokens.css, as data for the design page and checks.
 * `npm run check:tokens` fails if the two files disagree.
 */

export type ColorGroup = "Surfaces" | "Ink" | "Accent" | "Inverse" | "Controls" | "Status";

export type ColorToken = {
  name: string;
  hex: string;
  group: ColorGroup;
  use: string;
  /** The role it is measured against, the words that describe it, and the floor it must meet. */
  measure?: { against: string; label: string; min: number };
};

const text = 4.5;
const boundary = 3;

export const colors: ColorToken[] = [
  { name: "canvas", hex: "#FFFFFF", group: "Surfaces", use: "Page and app background" },
  { name: "surface", hex: "#FAFAFA", group: "Surfaces", use: "Sidebars and secondary panels" },
  { name: "surface-2", hex: "#F4F4F5", group: "Surfaces", use: "Hover and selected rows, tiles, wells" },
  { name: "hairline", hex: "#EBEBEB", group: "Surfaces", use: "1px borders and dividers" },
  { name: "hairline-strong", hex: "#D4D4D8", group: "Surfaces", use: "Strong dividers that are not controls" },
  { name: "ink-strong", hex: "#111111", group: "Ink", use: "Headings and emphasized values", measure: { against: "canvas", label: "on canvas", min: text } },
  { name: "ink", hex: "#333333", group: "Ink", use: "Default text", measure: { against: "canvas", label: "on canvas", min: text } },
  { name: "ink-subtle", hex: "#6B6B6B", group: "Ink", use: "Secondary text and placeholders", measure: { against: "surface-2", label: "on surface-2, its worst case", min: text } },
  { name: "primary", hex: "#0070E0", group: "Accent", use: "Primary action, focus, key data", measure: { against: "on-primary", label: "with its label", min: text } },
  { name: "primary-hover", hex: "#005FC2", group: "Accent", use: "Hover of primary, links on tiles", measure: { against: "on-primary", label: "with its label", min: text } },
  { name: "on-primary", hex: "#FFFFFF", group: "Accent", use: "Labels on primary" },
  { name: "link", hex: "#0070E0", group: "Accent", use: "Inline links", measure: { against: "canvas", label: "on canvas", min: text } },
  { name: "inverse", hex: "#111111", group: "Inverse", use: "Dark buttons, tooltips, toasts", measure: { against: "on-inverse", label: "with its label", min: text } },
  { name: "inverse-hover", hex: "#2B2B2B", group: "Inverse", use: "Hover of inverse", measure: { against: "on-inverse", label: "with its label", min: text } },
  { name: "on-inverse", hex: "#FFFFFF", group: "Inverse", use: "Labels on inverse" },
  { name: "control-border", hex: "#8A8A8A", group: "Controls", use: "Input, checkbox and radio borders", measure: { against: "canvas", label: "on canvas, as a boundary", min: boundary } },
  { name: "success", hex: "#15B042", group: "Status", use: "Status dot, always beside a label" },
  { name: "success-fill", hex: "#CAFACE", group: "Status", use: "Success badge fill" },
  { name: "on-success", hex: "#0E7A2F", group: "Status", use: "Success badge text", measure: { against: "success-fill", label: "on its fill", min: text } },
  { name: "warning-fill", hex: "#FFF1D6", group: "Status", use: "Warning badge fill" },
  { name: "on-warning", hex: "#8A4B00", group: "Status", use: "Warning badge text", measure: { against: "warning-fill", label: "on its fill", min: text } },
  { name: "danger", hex: "#D92D20", group: "Status", use: "Destructive button", measure: { against: "on-primary", label: "with a white label", min: text } },
  { name: "danger-fill", hex: "#FFE8E6", group: "Status", use: "Danger badge fill" },
  { name: "on-danger", hex: "#B42318", group: "Status", use: "Danger badge and error text", measure: { against: "danger-fill", label: "on its fill", min: text } },
  { name: "info-fill", hex: "#E6F0FF", group: "Status", use: "Info badge fill" },
  { name: "on-info", hex: "#0058B0", group: "Status", use: "Info badge text", measure: { against: "info-fill", label: "on its fill", min: text } },
];

export const colorGroups: ColorGroup[] = ["Surfaces", "Ink", "Accent", "Inverse", "Controls", "Status"];

export type TypeToken = {
  name: string;
  size: number;
  line: number;
  weight: 400 | 500;
  tracking: string;
  className: string;
  sample: string;
};

export const typeStyles: TypeToken[] = [
  { name: "display-xl", size: 72, line: 72, weight: 500, tracking: "-0.04em", className: "text-display-xl specimen-display", sample: "Settle $15 of debt with $2" },
  { name: "display-lg", size: 56, line: 58, weight: 500, tracking: "-0.035em", className: "text-display-lg specimen-display", sample: "Clear what you owe each other" },
  { name: "display-md", size: 44, line: 46, weight: 500, tracking: "-0.03em", className: "text-display-md specimen-display", sample: "Everyone signs, or nothing moves" },
  { name: "headline", size: 32, line: 36, weight: 500, tracking: "-0.025em", className: "text-headline", sample: "Clearing rounds" },
  { name: "title-lg", size: 24, line: 30, weight: 500, tracking: "-0.02em", className: "text-title-lg", sample: "Market Street circle" },
  { name: "title", size: 20, line: 26, weight: 500, tracking: "-0.015em", className: "text-title", sample: "Open invoices" },
  { name: "title-sm", size: 16, line: 20, weight: 500, tracking: "-0.01em", className: "text-title-sm", sample: "Round consent" },
  { name: "body-lg", size: 18, line: 28, weight: 400, tracking: "-0.01em", className: "text-body-lg", sample: "Add the invoices you share, and Salda finds the least cash that clears them." },
  { name: "body", size: 16, line: 24, weight: 400, tracking: "0em", className: "text-body", sample: "Ada’s Bakery owes Ben’s Farm 6.00 tUSD8." },
  { name: "body-sm", size: 14, line: 20, weight: 400, tracking: "0em", className: "text-body-sm", sample: "Waiting for Chidi Transport to sign." },
  { name: "label", size: 13, line: 16, weight: 500, tracking: "0em", className: "text-label", sample: "Cash you can spend" },
  { name: "label-sm", size: 12, line: 16, weight: 500, tracking: "0em", className: "text-label-sm", sample: "Cleared" },
  { name: "caption", size: 12, line: 16, weight: 400, tracking: "0em", className: "text-caption", sample: "Updated 2 minutes ago" },
  { name: "button", size: 13, line: 16, weight: 500, tracking: "0em", className: "text-button", sample: "Sign consent" },
  { name: "button-lg", size: 15, line: 20, weight: 500, tracking: "-0.01em", className: "text-button-lg", sample: "Try the live demo" },
  { name: "numeric", size: 32, line: 36, weight: 500, tracking: "-0.025em", className: "text-numeric tabular-nums", sample: "15.00" },
  { name: "mono", size: 12, line: 16, weight: 500, tracking: "0em", className: "font-mono text-mono", sample: "0x4565…3483" },
  { name: "eyebrow", size: 11, line: 14, weight: 500, tracking: "0.08em", className: "font-mono text-eyebrow uppercase", sample: "Section 04" },
];

export const spaces = [
  { name: "3xs", px: 2 },
  { name: "2xs", px: 4 },
  { name: "xs", px: 8 },
  { name: "sm", px: 12 },
  { name: "md", px: 16 },
  { name: "lg", px: 20 },
  { name: "xl", px: 24 },
  { name: "2xl", px: 32 },
  { name: "3xl", px: 40 },
  { name: "4xl", px: 48 },
  { name: "5xl", px: 64 },
  { name: "6xl", px: 96 },
  { name: "7xl", px: 128 },
] as const;

export const layoutWidths = [
  { name: "gutter", px: 24 },
  { name: "measure", px: 680 },
  { name: "container", px: 1280 },
  { name: "container-wide", px: 1400 },
] as const;

export const radii = [
  { name: "xs", px: 4, use: "Keyboard keys, checkboxes" },
  { name: "sm", px: 6, use: "Badges, tooltips" },
  { name: "md", px: 8, use: "Inputs, menus, sidebar items" },
  { name: "control", px: 10, use: "Buttons" },
  { name: "lg", px: 12, use: "App cards, panels" },
  { name: "xl", px: 16, use: "Dialogs, icon tiles" },
  { name: "2xl", px: 24, use: "Marketing tiles" },
  { name: "3xl", px: 32, use: "Hero panels" },
  { name: "full", px: 9999, use: "Pills, switches, avatars" },
] as const;

export const elevations = [
  { name: "tonal steps", className: "bg-surface-2", use: "Canvas, surface, surface-2. Try this first." },
  { name: "shadow-ring", className: "bg-canvas shadow-ring", use: "Cards and controls that need a crisp edge." },
  { name: "shadow-sm", className: "bg-canvas shadow-sm", use: "Pills, compact cards and icon tiles." },
  { name: "shadow-md", className: "bg-canvas shadow-md", use: "Popovers and raised cards." },
  { name: "shadow-lg", className: "bg-canvas shadow-lg", use: "Dialogs and hero media." },
] as const;

export type Curve = { name: string; points: [number, number, number, number]; use: string };

export const curves: Curve[] = [
  { name: "ease-out", points: [0.23, 1, 0.32, 1], use: "Default for entering and leaving" },
  { name: "ease-out-expo", points: [0.16, 1, 0.3, 1], use: "Larger entrances and reveals" },
  { name: "ease-in-out", points: [0.77, 0, 0.175, 1], use: "Things moving across the screen" },
  { name: "ease-drawer", points: [0.32, 0.72, 0, 1], use: "Sheets and drawers" },
  { name: "ease-standard", points: [0.4, 0, 0.2, 1], use: "Color and state changes" },
];

export const durations = [
  { name: "press", ms: 160 },
  { name: "fast", ms: 150 },
  { name: "base", ms: 200 },
  { name: "slow", ms: 300 },
  { name: "enter", ms: 400 },
  { name: "hero", ms: 700 },
] as const;
