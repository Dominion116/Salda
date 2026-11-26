import Image from "next/image";
import { cx } from "@/lib/cx";

/**
 * The Salda wordmark. It names the link it sits in, so the image's alt text is the brand name.
 * Source: public/brand/salda-logo.png (251 x 96, black on transparent), drawn 24 to 28px tall.
 */
export function SaldaLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/salda-logo.png"
      alt="Salda"
      width={251}
      height={96}
      priority={priority}
      unoptimized
      className={cx("h-6 w-auto", className)}
    />
  );
}
