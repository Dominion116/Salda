export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-2 focus:z-(--z-tooltip) focus:rounded-full focus:bg-canvas focus:shadow-md focus:px-4 focus:py-2 focus:text-button focus:text-ink-strong"
    >
      Skip to content
    </a>
  );
}
