import type { Metadata } from "next";
import { AgentScreen } from "@/components/app/screens/agent";

export const metadata: Metadata = { title: "Agent" };

export default function Page() {
  return <AgentScreen />;
}
