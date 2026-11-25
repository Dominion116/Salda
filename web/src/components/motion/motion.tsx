"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

/*
 * Landing page motion. Every effect is opt-in: the start states in motion.css apply only under
 * [data-motion], which app/layout.tsx sets before first paint for viewers who allow motion, and
 * removes again if these scripts never start. Content is always readable without JavaScript.
 */

declare global {
  interface Window {
    __saldaMotion?: boolean;
  }
}

const allowsMotion = () => window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

type Variant = "rise" | "scale" | "left" | "clip" | "letters";

type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "ul" | "ol" | "dl" | "p" | "span";
  /** Animates the [data-reveal-item], [data-reveal-row] and .word elements inside, in order. */
  variant?: Variant;
  /** Sweeps a line across the top edge when it arrives. */
  line?: boolean;
  threshold?: number;
  children: ReactNode;
};

/** Marks itself as in view the first time it scrolls into view, which starts the CSS. */
export function Reveal({ as = "div", variant, line, threshold = 0.15, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    window.__saldaMotion = true;
    const node = ref.current;
    if (!node) return;
    let index = 0;
    node.querySelectorAll<HTMLElement>("[data-reveal-item]").forEach((item) => {
      if (item.closest("[data-reveal]") !== node) return;
      item.style.setProperty("--i", String(index));
      index += 1;
    });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        node.setAttribute("data-inview", "");
        observer.disconnect();
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} data-reveal="" data-group={variant} data-line={line ? "" : undefined} {...rest}>
      {children}
    </Tag>
  );
}

/** Counts from one number to another when it scrolls into view. Screen readers get the final value. */
export function CountUp({
  from,
  to,
  decimals = 2,
  duration = 1600,
  className,
}: {
  from: number;
  to: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const node = ref.current;
    if (!node || !allowsMotion()) return;
    setValue(from);
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const started = performance.now();
        const step = (time: number) => {
          const t = Math.min((time - started) / duration, 1);
          setValue(from + (to - from) * (1 - (1 - t) ** 4));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [from, to, duration]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {value.toFixed(decimals)}
      </span>
      <span className="sr-only">{to.toFixed(decimals)}</span>
    </span>
  );
}

/**
 * A heading whose words darken one by one as it scrolls up the screen. Strong words start in
 * the subtle ink (5.3:1), so the text stays readable at every point.
 */
export function ScrubHeading({
  id,
  className,
  parts,
}: {
  id: string;
  className?: string;
  parts: readonly { text: string; tone: "strong" | "subtle" }[];
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = parts.flatMap((part) => part.text.split(" ").map((word) => ({ word, tone: part.tone })));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!allowsMotion()) {
      node.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      const height = window.innerHeight;
      const progress = (height * 0.85 - box.top) / (box.height + height * 0.4);
      node.style.setProperty("--p", Math.min(Math.max(progress, 0), 1).toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <h2 ref={ref} id={id} className={cx("scrub", className)} style={{ "--n": words.filter((item) => item.tone === "strong").length } as CSSProperties}>
      {words.map(({ word, tone }, index) => (
        <span key={index}>
          <span
            className={tone === "strong" ? "scrub-word" : "text-ink-subtle"}
            style={{ "--i": index } as CSSProperties}
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h2>
  );
}

const finePointer = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/** Tilts toward the cursor, with a soft light that follows it. Mouse only. */
export function Tilt({
  className,
  max = 7,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { max?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useRef(false);

  useEffect(() => {
    enabled.current = window.matchMedia(finePointer).matches;
  }, []);

  return (
    <div
      ref={ref}
      className={cx("tilt", className)}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node || !enabled.current) return;
        const box = node.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        node.style.setProperty("--rx", `${((0.5 - y) * max).toFixed(2)}deg`);
        node.style.setProperty("--ry", `${((x - 0.5) * max).toFixed(2)}deg`);
        node.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        node.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
        node.setAttribute("data-tilting", "");
      }}
      onPointerLeave={() => {
        const node = ref.current;
        if (!node) return;
        node.style.setProperty("--rx", "0deg");
        node.style.setProperty("--ry", "0deg");
        node.removeAttribute("data-tilting");
      }}
      {...rest}
    >
      {children}
      <span aria-hidden="true" className="tilt-glare" />
    </div>
  );
}

/** Drifts a few pixels toward the cursor while it is near. Mouse only. */
export function Magnetic({ children, strength = 10 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useRef(false);

  useEffect(() => {
    enabled.current = window.matchMedia(finePointer).matches;
  }, []);

  return (
    <span
      ref={ref}
      className="magnetic"
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node || !enabled.current) return;
        const box = node.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        node.style.setProperty("--tx", `${(x * strength).toFixed(1)}px`);
        node.style.setProperty("--ty", `${(y * strength).toFixed(1)}px`);
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--tx", "0px");
        ref.current?.style.setProperty("--ty", "0px");
      }}
    >
      {children}
    </span>
  );
}
