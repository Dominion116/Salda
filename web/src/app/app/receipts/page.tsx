import type { Metadata } from "next";
import { ReceiptsScreen } from "@/components/app/screens/rounds";

export const metadata: Metadata = { title: "Receipts" };

export default function Page() {
  return <ReceiptsScreen />;
}
