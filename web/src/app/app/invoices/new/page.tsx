import type { Metadata } from "next";
import { NewInvoiceScreen } from "@/components/app/screens/invoices";

export const metadata: Metadata = { title: "Add an invoice" };

export default function Page() {
  return <NewInvoiceScreen />;
}
