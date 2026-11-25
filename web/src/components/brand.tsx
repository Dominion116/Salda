/** Three parties joined in a ring. Decorative beside the wordmark. */
export function SaldaMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false" className="text-primary">
      <path d="M10 4 16 15H4L10 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="4" r="3" fill="currentColor" />
      <circle cx="4" cy="15" r="3" fill="currentColor" />
      <circle cx="16" cy="15" r="3" fill="currentColor" />
    </svg>
  );
}
