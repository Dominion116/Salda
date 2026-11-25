import type { Metadata } from "next";
import { CosignScreen } from "@/components/app/screens/invoices";

export const metadata: Metadata = { title: "Sign an invoice" };

export default function Page() {
  return <CosignScreen />;
}
