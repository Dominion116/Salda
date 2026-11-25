import type { Metadata } from "next";
import { InvoiceScreen } from "@/components/app/screens/invoices";

export const metadata: Metadata = { title: "Invoice" };

export default function Page() {
  return <InvoiceScreen />;
}
