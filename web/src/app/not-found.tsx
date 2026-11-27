import type { Metadata } from "next";
import Link from "next/link";
import { container } from "@/components/layout/container";
import { SiteLayout } from "@/components/layout/site";
import { buttonClass } from "@/components/ui/button-class";
import { cx } from "@/lib/cx";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist. Try the demo, the docs or the home page.",
};

export default function NotFound() {
  return (
    <SiteLayout rails={false}>
      <div className={cx(container, "flex flex-col items-start gap-6 py-24 lg:py-32")}>
        <p className="text-label text-ink-subtle">Error 404</p>
        <h1 className="max-w-[20ch] text-headline text-balance text-ink-strong lg:text-display-md">
          This page doesn’t exist
        </h1>
        <p className="max-w-measure text-body-lg text-pretty text-ink">
          The link may be old or mistyped. Nothing was lost: your invoices and rounds live onchain, not on this page.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/" className={buttonClass({ variant: "primary", size: "lg" })}>
            Go to the home page
          </Link>
          <Link href="/demo" className={buttonClass({ size: "lg" })}>
            Try the demo
          </Link>
          <Link href="/docs" className={buttonClass({ variant: "ghost", size: "lg" })}>
            Read the docs
          </Link>
        </div>
      </div>
    </SiteLayout>
  );
}
