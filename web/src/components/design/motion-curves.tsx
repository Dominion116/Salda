"use client";

import { useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "@/components/ui/icons";
import { curves } from "@/design/tokens";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

export function MotionCurves() {
  const tracks = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );

  const play = () => {
    tracks.current?.querySelectorAll<HTMLElement>("[data-curve]").forEach((dot) => {
      const track = dot.parentElement;
      if (!track) return;
      const distance = track.clientWidth - dot.offsetWidth;
      dot.getAnimations().forEach((animation) => animation.cancel());
      dot.animate([{ transform: "translateX(0)" }, { transform: `translateX(${distance}px)` }], {
        duration: 700,
        easing: dot.dataset.curve,
      });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={<PlayIcon />} onClick={play} disabled={reduced} aria-describedby="motion-note">
          Play the curves
        </Button>
        <p id="motion-note" className="text-body-sm text-ink-subtle">
          {reduced
            ? "Your device asks for reduced motion, so the curves stay still."
            : "Slowed to 700ms so you can compare them."}
        </p>
      </div>
      <div ref={tracks}>
        {curves.map((curve) => {
          const easing = `cubic-bezier(${curve.points.join(", ")})`;
          const [x1, y1, x2, y2] = curve.points;
          return (
            <div
              key={curve.name}
              className="grid grid-cols-[48px_1fr] items-center gap-x-4 gap-y-3 border-t border-hairline py-4 lg:grid-cols-[48px_1fr_320px]"
            >
              <svg viewBox="0 0 48 48" className="size-12 text-ink-strong" aria-hidden="true" focusable="false">
                <path d="M4 44h40M4 44V4" className="stroke-hairline-strong" fill="none" />
                <path
                  d={`M4 44C${4 + x1 * 40} ${44 - y1 * 40} ${4 + x2 * 40} ${44 - y2 * 40} 44 4`}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-title-sm text-ink-strong">{curve.name}</p>
                <p className="text-body-sm text-ink-subtle">{curve.use}</p>
                <p className="font-mono text-mono wrap-anywhere text-ink-subtle">{easing}</p>
              </div>
              <div className="col-span-2 h-2 rounded-full bg-surface-2 lg:col-span-1" aria-hidden="true">
                <div data-curve={easing} className="size-2 rounded-full bg-ink-strong" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
