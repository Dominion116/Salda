import type { Metadata } from "next";
import { ReceiptScreen } from "@/components/app/screens/rounds";

export const metadata: Metadata = { title: "Receipt" };

export default function Page() {
  return <ReceiptScreen />;
}
