import type { Metadata } from "next";
import { Clearing, Closing, Hero, Limits, Problem, Safety, Steps, Who } from "@/components/landing/sections";
import { SiteLayout } from "@/components/layout/site";

export const metadata: Metadata = {
  title: { absolute: "Salda: settle group debt with less cash" },
  description:
    "Salda cancels what a group of businesses owe each other and moves only the difference, in one settlement.",
};

export default function Home() {
  return (
    <SiteLayout skipLink={false}>
      <Hero />
      <Problem />
      <Clearing />
      <Who />
      <Safety />
      <Steps />
      <Limits />
      <Closing />
    </SiteLayout>
  );
}
