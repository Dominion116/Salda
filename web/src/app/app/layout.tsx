import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/app/app-frame";

export const metadata: Metadata = { robots: { index: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
