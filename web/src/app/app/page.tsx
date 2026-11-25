import type { Metadata } from "next";
import { HomeScreen } from "@/components/app/screens/home";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <HomeScreen />;
}
