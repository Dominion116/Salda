import type { Metadata } from "next";
import { NewRoundScreen } from "@/components/app/screens/rounds";

export const metadata: Metadata = { title: "Plan a round" };

export default function Page() {
  return <NewRoundScreen />;
}
