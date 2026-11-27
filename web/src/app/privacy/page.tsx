import type { Metadata } from "next";
import { DocShell, type OutlineGroup } from "@/components/docs/doc-shell";
import { A, Code, List, Note, P, Section, Table } from "@/components/docs/prose";
import { SiteLayout } from "@/components/layout/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Salda’s website and testnet service collect, why, how long they keep it, and what is public onchain.",
};

const UPDATED = "November 27, 2026";

const outline: OutlineGroup[] = [
  {
    title: "Privacy policy",
    items: [
      { id: "summary", title: "In short" },
      { id: "onchain", title: "What is public onchain" },
      { id: "collect", title: "What we collect" },
      { id: "use", title: "How we use it" },
      { id: "keep", title: "How long we keep it" },
      { id: "services", title: "Services we rely on" },
      { id: "browser", title: "Your browser" },
      { id: "choices", title: "Your choices" },
      { id: "children", title: "Children" },
      { id: "changes", title: "Changes" },
      { id: "contact", title: "Contact" },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <SiteLayout rails={false}>
      <DocShell
        title="Privacy policy"
        columns={2}
        outline={outline}
        intro={
          <p>
            Last updated {UPDATED}. This policy covers the Salda website, app and demo, and the server that supports them. Salda
            is a prototype that runs on a test network with test tokens.
          </p>
        }
      >
        <Section id="summary" title="In short">
          <List>
            <li>We do not ask for your name, email or phone number, and we do not use analytics or advertising trackers.</li>
            <li>Your wallet address and what you do onchain are public, because that is how blockchains work.</li>
            <li>Business names never go onchain. We keep them, with a random salt, and show them only to members of the same circle.</li>
            <li>We never upload invoice documents. Only a salted fingerprint of each one is recorded.</li>
            <li>We do not sell or rent any information.</li>
          </List>
        </Section>

        <Section id="onchain" title="What is public onchain">
          <P>
            When you use Salda with a wallet, the following is written to the QDay Aevum testnet. Anyone can read it, and no one,
            including us, can change or delete it:
          </P>
          <List>
            <li>Your wallet address and the circles it belongs to.</li>
            <li>Each invoice’s two businesses, amount, due date and how much has cleared.</li>
            <li>Each settled round: which invoices cleared, and how much each business paid or received.</li>
            <li>Your standing mandate’s limits, if you activate one.</li>
            <li>Salted hashes of business names, circle names and invoice documents. These cannot be reversed without the salt.</li>
          </List>
          <Note title="Use a separate wallet if this matters to you">
            <p>Using a different wallet address for each circle makes your activity harder to link across circles.</p>
          </Note>
        </Section>

        <Section id="collect" title="What we collect">
          <P>Our server keeps only what it needs to pass work between the businesses in a circle:</P>
          <Table
            caption="Information the server keeps"
            head={["Information", "Why", "Kept for"]}
            rows={[
              ["Business and circle names, with their salts", "To show members a checked name before they sign", "Until the service is shut down"],
              ["Invoices signed by one business and waiting for the other", "So the other business can review and sign", "Until signed, or up to 2 days"],
              ["Void requests waiting for the other business", "So the other business can agree", "Until signed, or up to 2 days"],
              ["Rounds, and the signatures collected for them", "So a round survives a refresh and settles once everyone agrees", "30 days"],
              ["Cash limits you set", "To plan rounds", "Until you change them"],
              ["The agent’s activity log", "To show what the agent did and why", "30 days"],
              ["Demo sessions", "To run the judge demo", "1 day"],
              ["Request counters by network address and wallet", "To prevent abuse of free fees and test tokens", "1 minute to 1 day"],
            ]}
          />
          <P>
            Names and salts are given only to someone who proves, with a fresh signature, that their wallet is an active member
            of that circle. They are not written to server logs.
          </P>
        </Section>

        <Section id="use" title="How we use it">
          <List>
            <li>To run Salda: collect signatures, plan and submit rounds, and pay network fees for you.</li>
            <li>To keep the free relayer and demo tokens from being abused, using rate limits.</li>
            <li>To fix problems, using short-lived error logs that do not include names, salts or signatures.</li>
          </List>
          <P>
            When the AI agent plans a round, the circle data it needs is sent to Groq, which runs the language model, as listed
            under Services we rely on. We do not use your information for advertising or profiling, and we do not use it to train
            models.
          </P>
        </Section>

        <Section id="keep" title="How long we keep it">
          <P>
            Items expire on the schedule above. If the shared store is not configured, everything lives only in the server’s
            memory and is lost when it restarts. Onchain records are permanent.
          </P>
        </Section>

        <Section id="services" title="Services we rely on">
          <Table
            caption="Third-party services"
            head={["Service", "What it receives"]}
            rows={[
              ["Vercel (hosting)", "Standard request information, such as your network address and browser, in its logs"],
              ["Upstash (the store)", "The information listed under What we collect"],
              [
                "Groq (the AI agent’s model)",
                "When the AI agent plans a round: the circle’s open invoices, amounts, due dates, invoice notes and mandate limits, with businesses shown only as M1, M2 and so on. Never names, wallet addresses or keys",
              ],
              ["QDay Aevum testnet RPC", "The onchain reads and transactions your browser and our server send"],
              ["WalletConnect by Reown", "Connection details, only if you connect a phone wallet through it"],
              ["Your wallet provider", "Whatever its own policy covers. We never see your private keys"],
            ]}
          />
          <P>Fonts are bundled with the site, so loading a page does not contact a font service.</P>
        </Section>

        <Section id="browser" title="Your browser">
          <P>
            We do not set cookies. Your browser keeps which wallet you last connected, and WalletConnect’s session if you use it,
            in its own site storage so it can reconnect. You can clear it at any time in your browser’s settings. The demo’s
            sample data lives only in the open tab.
          </P>
        </Section>

        <Section id="choices" title="Your choices">
          <List>
            <li>You can use the landing page, the sample app and the sample demo without connecting a wallet.</li>
            <li>You can revoke a standing mandate at any time, with no fee.</li>
            <li>
              A circle’s admin can change or deactivate a member. To ask us to delete a name or salt we hold, open an issue as
              described under Contact. Onchain records cannot be deleted by anyone.
            </li>
          </List>
        </Section>

        <Section id="children" title="Children">
          <P>Salda is for businesses and is not meant for anyone under 18.</P>
        </Section>

        <Section id="changes" title="Changes">
          <P>
            If this policy changes, we update the date at the top of this page. The full history of this page is public in the
            source code repository.
          </P>
        </Section>

        <Section id="contact" title="Contact">
          <P>
            Open an issue at <A href="https://github.com/Dominion116/Salda/issues">github.com/Dominion116/Salda</A>. Do not post
            private keys, signatures or anything else you want kept private in a public issue. For a deletion request, say which
            circle and wallet it concerns, and we will reply there.
          </P>
          <P>
            See also the <A href="/terms">terms of service</A> and, for how the system protects you, the{" "}
            <A href="/docs#security">security model</A>. The <Code>tUSD8</Code> token and the Aevum network are run by others,
            under their own terms.
          </P>
        </Section>
      </DocShell>
    </SiteLayout>
  );
}
