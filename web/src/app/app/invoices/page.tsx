import type { Metadata } from "next";
import { InvoicesScreen } from "@/components/app/screens/invoices";

export const metadata: Metadata = { title: "Invoices" };

export default function Page() {
  return <InvoicesScreen />;
}
