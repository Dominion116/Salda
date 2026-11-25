import type { Metadata } from "next";
import { MandateScreen } from "@/components/app/screens/mandate";

export const metadata: Metadata = { title: "Mandate" };

export default function Page() {
  return <MandateScreen />;
}
