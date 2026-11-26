import type { Metadata } from "next";
import { DocShell, type OutlineGroup } from "@/components/docs/doc-shell";
import { A, Code, List, Note, P, Section } from "@/components/docs/prose";
import { SiteLayout } from "@/components/layout/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Salda, a testnet prototype for clearing debts between businesses.",
};

const UPDATED = "November 26, 2026";

const outline: OutlineGroup[] = [
  {
    title: "Terms of service",
    items: [
      { id: "agreement", title: "Agreement" },
      { id: "testnet", title: "A test version" },
      { id: "service", title: "What Salda does" },
      { id: "wallet", title: "Your wallet and signatures" },
      { id: "circles", title: "Circles and names" },
      { id: "mandates", title: "Mandates and the agent" },
      { id: "fees", title: "Fees and free tokens" },
      { id: "acceptable", title: "Acceptable use" },
      { id: "advice", title: "Not advice" },
      { id: "warranty", title: "No warranty" },
      { id: "liability", title: "Limitation of liability" },
      { id: "source", title: "Open source" },
      { id: "ending", title: "Changes and ending" },
      { id: "contact", title: "Contact" },
    ],
  },
];

export default function TermsPage() {
  return (
    <SiteLayout rails={false}>
      <DocShell
        title="Terms of service"
        columns={2}
        outline={outline}
        intro={
          <p>
            Last updated {UPDATED}. These terms cover the Salda website, app, demo and the server that supports them. Please read
            them with the <A href="/privacy">privacy policy</A>.
          </p>
        }
      >
        <Section id="agreement" title="Agreement">
          <P>
            By using Salda you agree to these terms. If you use it for a business, you confirm you may agree for that business.
            If you do not agree, do not use Salda.
          </P>
        </Section>

        <Section id="testnet" title="A test version">
          <Note title="Test tokens only">
            <p>
              Salda runs on the QDay Aevum testnet with <Code>tUSD8</Code>, a test token with no monetary value. Do not use it to
              settle real debts, and do not send it anything of real value.
            </p>
          </Note>
          <P>
            Salda is a prototype built for Aevum Builder Challenge #1. Its contract has not been audited. Features may change,
            break or be removed, and the test network itself may be reset by its operators.
          </P>
        </Section>

        <Section id="service" title="What Salda does">
          <P>
            Salda helps a group of businesses record what they owe each other and settle the difference in one step. It does not
            hold your funds: each settlement moves tokens directly between the businesses, in one transaction that either
            completes in full or does nothing. Salda does not lend, guarantee payment, or collect debts.
          </P>
          <P>
            An invoice recorded in Salda is a record that two businesses signed. It does not replace your own invoices,
            contracts or accounts, and Salda does not check that the underlying trade happened.
          </P>
        </Section>

        <Section id="wallet" title="Your wallet and signatures">
          <List>
            <li>You control your wallet and its keys. We never see them and cannot recover them.</li>
            <li>
              A signature you give is an instruction. Read what your wallet shows before you sign: once a round settles, it cannot
              be undone.
            </li>
            <li>You are responsible for the wallets you connect and for everything signed with them.</li>
          </List>
        </Section>

        <Section id="circles" title="Circles and names">
          <P>
            A circle’s admin decides who joins and confirms each member’s business name. Salda shows those names but does not
            verify the businesses behind them. A name is only as reliable as the admin who confirmed it. Only add businesses you
            know, and only trust circles whose admin you trust.
          </P>
        </Section>

        <Section id="mandates" title="Mandates and the agent">
          <P>
            If you activate a standing mandate, you authorize Salda’s agent to agree to rounds for you within the limits you set,
            and you approve Salda to spend up to the mandate’s total limit for those rounds. The contract enforces your limits.
            You can revoke a mandate at any time, and it takes effect at once.
          </P>
          <P>
            The agent plans rounds automatically. It may not find the best possible round, and it may not run at all if the
            service is down.
          </P>
        </Section>

        <Section id="fees" title="Fees and free tokens">
          <P>
            Salda pays the network fees for actions it relays, and the demo may give you a small amount of test tokens. Both are
            limited and may stop at any time. Anyone with test gas can submit a signed round without our relayer.
          </P>
        </Section>

        <Section id="acceptable" title="Acceptable use">
          <P>Do not:</P>
          <List>
            <li>Try to drain the relayer’s fees or the demo’s test tokens, including by using many wallets or addresses.</li>
            <li>Disrupt the service, probe it for weaknesses without permission, or get around its rate limits.</li>
            <li>Record invoices you know to be false, or misrepresent a business in a circle you run.</li>
            <li>Use Salda for anything unlawful where you are.</li>
          </List>
          <P>
            If you find a security problem, please report it privately rather than exploiting it. See Contact for how to reach
            us.
          </P>
        </Section>

        <Section id="advice" title="Not advice">
          <P>
            Nothing in Salda is financial, legal, tax or accounting advice. Whether clearing debts this way is valid for your
            business depends on your agreements and your country’s law. Get your own advice before relying on it.
          </P>
        </Section>

        <Section id="warranty" title="No warranty">
          <P>
            Salda is provided as is and as available, without warranties of any kind, express or implied, including fitness for
            a particular purpose, accuracy, or that it will work without interruption or errors.
          </P>
        </Section>

        <Section id="liability" title="Limitation of liability">
          <P>
            To the fullest extent the law allows, the people who build and run Salda are not liable for any loss arising from
            your use of it, including lost tokens, failed or mistaken settlements, unavailable service, or acts of other members,
            circle admins, wallet providers, the token issuer or the network.
          </P>
        </Section>

        <Section id="source" title="Open source">
          <P>
            Salda’s code is published under the MIT License, which has its own terms for using, copying and changing the code.
            These terms cover the service we run, not your use of the code. Third-party parts carry their own licenses, listed in
            the repository’s notices.
          </P>
        </Section>

        <Section id="ending" title="Changes and ending">
          <P>
            We may change these terms, or change, pause or end the service, at any time. If the terms change, we update the date
            at the top of this page, and continuing to use Salda means you accept the new version. Records already onchain stay
            there regardless.
          </P>
        </Section>

        <Section id="contact" title="Contact">
          <P>
            Open an issue at <A href="https://github.com/Dominion116/Salda/issues">github.com/Dominion116/Salda</A>. For a
            security problem, open an issue that asks for a private contact, without the details, and we will reply there.
          </P>
        </Section>
      </DocShell>
    </SiteLayout>
  );
}
