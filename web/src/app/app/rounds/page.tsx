import type { Metadata } from "next";
import { RoundsScreen } from "@/components/app/screens/rounds";

export const metadata: Metadata = { title: "Rounds" };

export default function Page() {
  return <RoundsScreen />;
}
