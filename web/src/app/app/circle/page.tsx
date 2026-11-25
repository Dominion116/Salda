import type { Metadata } from "next";
import { CircleScreen } from "@/components/app/screens/circle";

export const metadata: Metadata = { title: "Circle" };

export default function Page() {
  return <CircleScreen />;
}
