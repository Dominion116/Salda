import type { Metadata } from "next";
import { RoundScreen } from "@/components/app/screens/rounds";

export const metadata: Metadata = { title: "Round" };

export default function Page() {
  return <RoundScreen />;
}
