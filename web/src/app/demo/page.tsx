import type { Metadata } from "next";
import { DemoScreen } from "@/components/demo/demo-screen";

export const metadata: Metadata = {
  title: "Demo",
  description: "Settle three shops’ debts with 0.02 tUSD8, then try to break the safety checks.",
};

export default function Page() {
  return <DemoScreen />;
}
