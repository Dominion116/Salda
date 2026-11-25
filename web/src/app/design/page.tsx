import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SaldaMark } from "@/components/brand";
import { Gallery } from "@/components/design/gallery";
import { MotionCurves } from "@/components/design/motion-curves";
import { Swatch } from "@/components/design/swatch";
import { SkipLink } from "@/components/layout/skip-link";
import { ToastProvider } from "@/components/ui/toast";
import { contrast } from "@/design/contrast";
import {
  colorGroups,
  colors,
  durations,
  elevations,
  layoutWidths,
  radii,
  spaces,
  typeStyles,
  type ColorToken,
} from "@/design/tokens";

export const metadata: Metadata = {
  title: "Design system",
  description: "The colors, type, space, motion and components behind every Salda screen.",
  robots: { index: false },
};

const sections = [
  { id: "laws", label: "Laws" },
  { id: "color", label: "Color" },
  { id: "type", label: "Type" },
  { id: "space", label: "Space" },
  { id: "radius", label: "Radius" },
  { id: "elevation", label: "Elevation" },
  { id: "motion", label: "Motion" },
  { id: "components", label: "Components" },
] as const;

const laws = [
  ["Ask for one thing", "Each screen has one focal point and one main action: add, sign or settle."],
  ["Let neutrals lead", "Blue marks the main action, focus, key numbers and the brand mark. Nothing else."],
  ["Use size before weight", "Big type is large and tight at weight 500. Nothing is set bolder than that."],
  ["Group with space", "The gap between groups is at least twice the gap inside one."],
  ["Draw hairlines before boxes", "Use a thin line or a change of tone before a border, and never a border with a heavy shadow."],
  ["Nest corners", "An inner corner equals the outer corner minus the padding between them."],
  ["Show the product", "Use working Salda interface with believable amounts in place of illustration."],
  ["Design every state", "Controls cover hover, focus, press and disabled. Data covers loading, empty and error."],
  ["Move to explain", "Interface motion stays under 300ms and shows what changed or where it went."],
  ["Work for everyone", "Text meets AA contrast, everything works by keyboard, and reduced motion is respected."],
  ["Keep one loud idea", "Each page gets a single memorable moment. Everything around it stays quiet."],
  ["Treat numbers as interface", "Amounts line up, units step back, and every total says what it counts."],
] as const;

function measured(color: ColorToken): string | undefined {
  const { measure } = color;
  if (!measure) return undefined;
  const other = colors.find((candidate) => candidate.name === measure.against);
  if (!other) return undefined;
  return `${contrast(color.hex, other.hex).toFixed(2)}:1 ${measure.label}`;
}

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="py-16 lg:py-24">
      <div className="grid gap-4 pb-12 lg:grid-cols-12 lg:gap-6">
        <h2 id={`${id}-title`} className="text-headline text-ink-strong lg:col-span-7 lg:text-display-md">
          {title}
        </h2>
        <p className="max-w-[48ch] text-body-lg text-pretty text-ink-subtle lg:col-span-5 lg:pt-2">{lede}</p>
      </div>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <ToastProvider>
      <SkipLink />

      <header className="sticky top-0 z-(--z-sticky) border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-14 max-w-page items-center gap-6 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="hit-44 flex shrink-0 items-center gap-2 text-title-sm text-ink-strong">
            <SaldaMark />
            Salda
          </Link>
          <nav aria-label="Design system sections" className="min-w-0 flex-1 overflow-x-auto">
            <ul className="flex items-center lg:justify-end">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex h-11 items-center px-3 text-body-sm whitespace-nowrap text-ink-subtle -outline-offset-2 transition-[color] duration-150 ease-standard hover:text-ink-strong"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-page px-4 sm:px-6 lg:px-10">
        <div className="pt-16 pb-16 lg:pt-24 lg:pb-24">
          <h1 className="display-fluid max-w-[14ch] text-ink-strong">The rules behind every Salda screen</h1>
          <p className="max-w-[56ch] pt-6 text-body-lg text-pretty text-ink-subtle">
            {colors.length} colors, {typeStyles.length} type styles and {radii.length} radii. They are set once, checked
            together, and shared by every page.
          </p>
        </div>

        {/* The page's one loud idea: every color role, side by side. */}
        <div
          aria-hidden="true"
          className="flex h-60 overflow-hidden rounded-2xl shadow-ring lg:h-90"
        >
          {colors.map((color) => (
            <span key={color.name} className="flex-1" style={{ background: `var(--color-${color.name})` }} />
          ))}
        </div>

        <Section id="laws" title="Twelve laws" lede="Stay quiet and precise everywhere, with one loud idea per page. The rest of this page applies these.">
          <ol className="grid gap-x-6 md:grid-cols-2 lg:grid-cols-3">
            {laws.map(([title, body], index) => (
              <li key={title} className="flex gap-4 border-t border-hairline py-6">
                <span aria-hidden="true" className="pt-0.5 font-mono text-mono text-ink-subtle tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-title-sm text-ink-strong">{title}</h3>
                  <p className="text-body-sm text-pretty text-ink-subtle">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="color" title="Every color is a role" lede="Each ratio is measured on the surface that role actually sits on. Select a value to copy it.">
          <div className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {colorGroups.map((group) => (
              <div key={group}>
                <h3 className="pb-4 text-title text-ink-strong">{group}</h3>
                {colors
                  .filter((color) => color.group === group)
                  .map((color) => (
                    <Swatch key={color.name} name={color.name} hex={color.hex} use={color.use} note={measured(color)} />
                  ))}
              </div>
            ))}
          </div>
        </Section>

        <Section id="type" title="One scale, eighteen styles" lede="Inter for the interface and Geist Mono for addresses and IDs. Tracking tightens as size grows. Display sizes step down to 44px on phones.">
          <dl>
            {typeStyles.map((style) => (
              <div key={style.name} className="grid items-baseline gap-2 border-t border-hairline py-6 lg:grid-cols-12 lg:gap-6">
                <dt className="flex flex-col gap-1 lg:col-span-3">
                  <span className="text-label text-ink-strong">{style.name}</span>
                  <span className="text-caption text-ink-subtle tabular-nums">
                    {style.size}/{style.line}px, {style.weight}, {style.tracking.replace("-", "−").replace("0em", "0")}
                  </span>
                </dt>
                <dd className={`min-w-0 text-ink-strong wrap-anywhere lg:col-span-9 ${style.className}`}>{style.sample}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="space" title="Everything on a 4px base" lede="8px inside a group and at least 16px between groups. Landing page sections sit 96 to 128px apart.">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
            <dl className="lg:col-span-7">
              {spaces.map((space) => (
                <div key={space.name} className="flex min-h-10 items-center gap-4 border-t border-hairline text-body-sm">
                  <dt className="w-12 text-ink-strong">{space.name}</dt>
                  <dd className="flex flex-1 items-center justify-between gap-4">
                    <span aria-hidden="true" className="h-3 rounded-xs bg-ink-strong" style={{ width: space.px }} />
                    <span className="text-ink-subtle tabular-nums">{space.px}px</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="lg:col-span-4 lg:col-start-9">
              <h3 className="pb-4 text-title text-ink-strong">Layout widths</h3>
              <dl>
                {layoutWidths.map((width) => (
                  <div key={width.name} className="flex min-h-10 items-center justify-between gap-4 border-t border-hairline text-body-sm">
                    <dt className="text-ink-strong">{width.name}</dt>
                    <dd className="text-ink-subtle tabular-nums">{width.px.toLocaleString("en-US")}px</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Section>

        <Section id="radius" title="Corners that agree" lede="10px controls, 12 to 16px cards and 24px landing page tiles. Pills are for small controls only.">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6">
            {radii.map((radius) => (
              <div key={radius.name} className="flex flex-col gap-4">
                <div
                  aria-hidden="true"
                  className="h-24 border border-hairline-strong bg-surface"
                  style={{ borderRadius: `var(--radius-${radius.name})` }}
                />
                <div className="flex flex-col gap-1">
                  <dt className="text-title-sm text-ink-strong">
                    {radius.name}
                    <span className="text-ink-subtle tabular-nums">{" "}{radius.px}px</span>
                  </dt>
                  <dd className="text-body-sm text-ink-subtle">{radius.use}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="grid items-center gap-6 pt-12 sm:grid-cols-2 lg:grid-cols-12">
            <div aria-hidden="true" className="rounded-2xl bg-surface-2 p-2 lg:col-span-4">
              <div className="h-32 rounded-xl bg-canvas shadow-ring" />
            </div>
            <p className="max-w-[48ch] text-body text-ink lg:col-span-6">
              Outer 24px minus 8px of padding gives an inner corner of 16px. Past 24px of padding, the two corners no longer
              need to match.
            </p>
          </div>
        </Section>

        <Section id="elevation" title="One depth method per surface" lede="Try them in this order: tone, hairline, ring, then shadow.">
          <dl className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {elevations.map((level) => (
              <div key={level.name} className="flex flex-col gap-6">
                <div aria-hidden="true" className={`h-32 rounded-lg ${level.className}`} />
                <div className="flex flex-col gap-1">
                  <dt className="text-title-sm text-ink-strong">{level.name}</dt>
                  <dd className="text-body-sm text-pretty text-ink-subtle">{level.use}</dd>
                </div>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="motion" title="Motion explains" lede="Ease out, stay under 300ms for anything interactive, and move less the more often something happens.">
          <MotionCurves />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 pt-12 sm:grid-cols-3 lg:grid-cols-6">
            {durations.map((duration) => (
              <div key={duration.name} className="flex flex-col gap-1 border-t border-hairline pt-4">
                <dt className="text-label text-ink-subtle">{duration.name}</dt>
                <dd className="text-title-lg text-ink-strong tabular-nums">
                  {duration.ms}
                  <span className="text-ink-subtle">ms</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="components" title="Components with every state" lede="These are the parts every Salda screen is built from. All names and amounts here are sample data.">
          <Gallery />
        </Section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 px-4 py-8 text-body-sm text-ink-subtle sm:px-6 lg:px-10">
          <p>Salda design system</p>
          <a href="#main" className="hit-44 text-link underline-offset-4 hover:text-primary-hover hover:underline">
            Back to the top
          </a>
        </div>
      </footer>
    </ToastProvider>
  );
}
