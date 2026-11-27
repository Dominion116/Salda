import type { Metadata } from "next";
import { DocShell, type OutlineGroup } from "@/components/docs/doc-shell";
import { A, Code, CodeBlock, H3, List, Note, P, Section, Table } from "@/components/docs/prose";
import { SiteLayout } from "@/components/layout/site";

export const metadata: Metadata = {
  title: "Docs",
  description: "How Salda clears what a group of businesses owe each other: concepts, guides, the contract, the API and the trust model.",
};

const outline: OutlineGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", title: "Overview", children: [{ id: "who", title: "Who it is for" }, { id: "status", title: "Project status" }] },
      { id: "quickstart", title: "Try it in a minute", children: [{ id: "no-wallet", title: "Without a wallet" }, { id: "with-wallet", title: "With a wallet" }] },
      { id: "example", title: "The three-shop example", children: [{ id: "example-cash", title: "What cash changes" }] },
    ],
  },
  {
    title: "Concepts",
    items: [
      { id: "circles", title: "Circles", children: [{ id: "names", title: "Business names" }, { id: "membership", title: "Joining and leaving" }] },
      {
        id: "invoices",
        title: "Invoices",
        children: [
          { id: "cosigning", title: "Co-signing" },
          { id: "voiding", title: "Voiding" },
          { id: "paying-direct", title: "Paying one directly" },
        ],
      },
      {
        id: "rounds",
        title: "Clearing rounds",
        children: [
          { id: "planning", title: "Planning a round" },
          { id: "consent", title: "Consent" },
          { id: "settlement", title: "Settlement" },
        ],
      },
      { id: "mandates", title: "Standing mandates", children: [{ id: "mandate-limits", title: "The limits" }, { id: "revoking", title: "Revoking" }] },
      { id: "agent", title: "The clearing agent", children: [{ id: "agent-can", title: "What it can and cannot do" }, { id: "compromised", title: "Compromised agent demo" }] },
    ],
  },
  {
    title: "Guides",
    items: [
      { id: "using-app", title: "Using the app", children: [{ id: "first-circle", title: "Your first circle" }, { id: "first-round", title: "Your first round" }] },
      { id: "judge-demo", title: "The judge demo", children: [{ id: "demo-steps", title: "Steps" }, { id: "demo-scale", title: "Why 1/100 scale" }] },
      {
        id: "self-host",
        title: "Run your own",
        children: [
          { id: "prerequisites", title: "Prerequisites" },
          { id: "local", title: "Run locally" },
          { id: "deploy", title: "Deploy" },
          { id: "tests", title: "Run the tests" },
        ],
      },
    ],
  },
  {
    title: "Reference",
    items: [
      {
        id: "contract",
        title: "Contract",
        children: [
          { id: "functions", title: "Functions" },
          { id: "signatures", title: "Signatures" },
          { id: "errors", title: "Errors" },
        ],
      },
      {
        id: "api",
        title: "HTTP API",
        children: [
          { id: "api-format", title: "Request format" },
          { id: "api-relay", title: "Relayer" },
          { id: "api-store", title: "Store" },
          { id: "api-agent", title: "Agent" },
          { id: "api-demo", title: "Demo" },
          { id: "api-limits", title: "Rate limits" },
        ],
      },
      { id: "environment", title: "Environment variables" },
      { id: "network", title: "Network facts" },
    ],
  },
  {
    title: "Trust",
    items: [
      { id: "security", title: "Security model", children: [{ id: "trusted", title: "Who you trust" }, { id: "not-trusted", title: "Who you do not" }] },
      { id: "privacy", title: "Privacy model" },
      { id: "constraints", title: "Known constraints" },
      {
        id: "faq",
        title: "Questions",
        children: [
          { id: "faq-silent", title: "If a business never signs" },
          { id: "faq-custody", title: "Does Salda hold money" },
          { id: "faq-agent", title: "Why an agent" },
          { id: "faq-legal", title: "Is set-off legal" },
        ],
      },
    ],
  },
];

export default function DocsPage() {
  return (
    <SiteLayout rails={false}>
      <DocShell
        title="Salda documentation"
        outline={outline}
        intro={
          <p>
            Salda cancels what a group of businesses owe each other and settles only the difference, in one all-or-nothing
            step. These pages explain how it works, how to use it, and exactly what you are trusting when you do.
          </p>
        }
      >
        <GettingStarted />
        <Concepts />
        <Guides />
        <Reference />
        <Trust />
      </DocShell>
    </SiteLayout>
  );
}

// ================================================================ getting started

function GettingStarted() {
  return (
    <>
      <Section id="overview" title="Overview">
        <P lead>
          Businesses that trade with each other often wait on each other to pay. Ada can’t pay Ben until Chidi pays her, Chidi
          is waiting on Ben, and Ben is waiting on Ada. Everyone has debts and nobody has the cash to go first.
        </P>
        <P>
          Salda looks at every open invoice in a group, finds the debts that cancel each other out, and moves only what is left.
          Each business signs first, the contract rechecks the whole round, and either all of it settles or none of it does.
          Salda never holds anyone’s money: payments go straight from the businesses that owe to the businesses that are owed.
        </P>
        <H3 id="who">Who it is for</H3>
        <List>
          <li>Cooperatives whose members buy from and sell to each other all season.</li>
          <li>Market associations whose traders settle up with their neighbors every week.</li>
          <li>Wholesaler networks with invoices running both ways between suppliers and shops.</li>
          <li>Company subsidiaries that bill each other and move cash in circles.</li>
        </List>
        <H3 id="status">Project status</H3>
        <P>
          Salda is an entry in Aevum Builder Challenge #1. It runs on the QDay Aevum testnet with <Code>tUSD8</Code>, a test
          stablecoin with no real value. The contract has not been audited. Treat everything here as a working prototype.
        </P>
      </Section>

      <Section id="quickstart" title="Try it in a minute">
        <H3 id="no-wallet">Without a wallet</H3>
        <List ordered>
          <li>
            Open the <A href="/#clearing">clearing graph</A> on the home page and move Ada’s cash from 0 to 2. Watch 12, then 14,
            then 15 of the 15 owed clear.
          </li>
          <li>
            Open the <A href="/demo">demo</A> and choose <strong className="font-medium">Continue with sample data</strong>. Every
            step works with sample data and nothing touches the network.
          </li>
          <li>
            Open the <A href="/app">app</A>. Until a wallet is connected on Aevum it runs on sample data, labelled as such, so you
            can click through every screen.
          </li>
        </List>
        <H3 id="with-wallet">With a wallet</H3>
        <P>
          Connect a browser wallet such as MetaMask or Rabby, or a phone wallet through WalletConnect. The app asks to add the
          Aevum testnet if your wallet does not have it. You do not need any test tokens for gas: Salda’s relayer pays every
          network fee.
        </P>
      </Section>

      <Section id="example" title="The three-shop example">
        <P>The example used everywhere in Salda: three shops with one invoice each.</P>
        <Table
          caption="The three invoices"
          head={["Invoice", "Amount (tUSD8)"]}
          rows={[
            ["Ada’s Bakery owes Ben’s Farm", "6.00"],
            ["Ben’s Farm owes Chidi Transport", "5.00"],
            ["Chidi Transport owes Ada’s Bakery", "4.00"],
            ["Total debt", "15.00"],
          ]}
        />
        <H3 id="example-cash">What cash changes</H3>
        <P>
          Only Ada has cash. The more she can spend, the more of the 15.00 clears. Even with none, 4.00 cancels around the whole
          loop, three times over.
        </P>
        <Table
          caption="Debt cleared for each amount of Ada’s cash"
          head={["Ada’s cash", "Cleared", "Ada pays", "Ben receives", "Chidi receives"]}
          rows={[
            ["0.00", "12.00", "0.00", "0.00", "0.00"],
            ["1.00", "14.00", "1.00", "0.00", "1.00"],
            ["2.00", "15.00", "2.00", "1.00", "1.00"],
          ]}
        />
      </Section>
    </>
  );
}

// ======================================================================= concepts

function Concepts() {
  return (
    <>
      <Section id="circles" title="Circles">
        <P>
          A circle is a private group whose debts can clear together. The person who creates it is its admin, and only members
          the admin adds can record invoices in it. One business can belong to several circles.
        </P>
        <H3 id="names">Business names</H3>
        <P>
          Names never go onchain in plain text. The admin records a salted hash of each member’s name,
          <Code>keccak256(member, name, salt)</Code>, and keeps the name and salt in Salda’s store. The app shows a name only
          when it matches that hash; otherwise it shows <strong className="font-medium">Unverified name</strong>. Only active
          members who sign a fresh request can read the names in their circle.
        </P>
        <P>
          A name is only as trustworthy as the admin who confirmed it. If a name changes after an invoice was recorded, the
          app warns you before you sign anything.
        </P>
        <H3 id="membership">Joining and leaving</H3>
        <P>
          The admin adds, renames and deactivates members. A deactivated member cannot be on new invoices, but debts that
          already exist can still be settled with their consent.
        </P>
      </Section>

      <Section id="invoices" title="Invoices">
        <P>An invoice records that one member owes another a fixed amount, due by a date. Onchain it stores:</P>
        <Table
          caption="Invoice fields"
          head={["Field", "Meaning"]}
          rows={[
            [<Code key="d">debtor</Code>, "The business that owes"],
            [<Code key="c">creditor</Code>, "The business that is owed"],
            [<Code key="a">amount</Code>, "In tUSD8 units (6 decimals, so 1,000,000 is 1.00)"],
            [<Code key="cl">cleared</Code>, "How much has been cleared or paid so far"],
            [<Code key="due">dueDate</Code>, "When it falls due, in Unix seconds"],
            [<Code key="doc">docHash</Code>, "A salted hash of the invoice document. The document itself is never uploaded"],
            [<Code key="v">voided</Code>, "True once both businesses have voided what is left"],
          ]}
        />
        <H3 id="cosigning">Co-signing</H3>
        <P>
          An invoice counts only when both businesses have signed it. The first signs in the app and gets a link; the other
          opens it with their own wallet, checks the names and amount, and signs. Salda then records it, paying the fee. Up to
          30 invoices can be recorded in one batch, with one signature from each business involved.
        </P>
        <H3 id="voiding">Voiding</H3>
        <P>
          Either business can ask to void what is left of an invoice. It is voided only when the other signs too. A voided
          invoice can never be cleared or paid again.
        </P>
        <H3 id="paying-direct">Paying one directly</H3>
        <P>
          The business that owes can pay part or all of one invoice straight to the business owed, at any time, by signing a
          one-time transfer authorization. This never touches the spending approval a mandate uses.
        </P>
      </Section>

      <Section id="rounds" title="Clearing rounds">
        <P>A round is one settlement: a list of invoices and how much to clear from each, settled all at once.</P>
        <H3 id="planning">Planning a round</H3>
        <P>
          Each business says how much cash it can spend. Salda’s solver then finds the plan that clears the most debt without
          asking anyone to pay more than they offered, and among equal plans, the one that moves the least cash. It runs in
          your browser on exact whole numbers, so the plan you review is the plan you sign.
        </P>
        <Note title="How the solver works">
          <p>
            It is a min-cost circulation: each invoice is a path money can flow along, each business can add cash up to its
            limit, and cycles of debt are cancelled until none remain. It is exact. A round with mandates adds one heuristic step,
            explained under standing mandates.
          </p>
        </Note>
        <H3 id="consent">Consent</H3>
        <P>Every business a round touches must agree, including those that pay nothing:</P>
        <List>
          <li>
            A business that pays signs a <Code>tUSD8</Code> authorization for exactly its net amount, valid for this round only.
          </li>
          <li>A business that receives, or moves no cash, signs an approval of the round.</li>
          <li>Or its standing mandate agrees for it, within the limits it set.</li>
        </List>
        <H3 id="settlement">Settlement</H3>
        <P>When everyone has agreed, anyone can submit the round; Salda’s relayer usually does. The contract then:</P>
        <List ordered>
          <li>Checks the deadline, the size limits and that no invoice appears twice.</li>
          <li>Checks every line against its invoice: same circle, not voided, and never more than is left.</li>
          <li>Works out each business’s net position and checks its consent.</li>
          <li>Pulls in every net payment, then pays out every net receipt.</li>
          <li>Requires the two totals to match, so the contract never keeps any money.</li>
        </List>
        <P>If any check fails, the whole round is refused and nothing moves. A settled round can never be settled again.</P>
      </Section>

      <Section id="mandates" title="Standing mandates">
        <P>
          A mandate lets a business take part in rounds without signing each one. It signs once, with limits, and an agent key
          can then approve rounds for it. The contract enforces every limit, so even an agent that has been taken over cannot go
          past them.
        </P>
        <H3 id="mandate-limits">The limits</H3>
        <Table
          caption="Mandate limits"
          head={["Limit", "What it stops"]}
          rows={[
            ["Most paid in one round", "A single round spending more than you allow"],
            ["Most paid in total", "Many small rounds adding up to more than you allow"],
            ["Least cleared for every 1.00 paid", "Paying a lot to clear very little. 3.0× means at least 3.00 cleared per 1.00 paid"],
            ["Invoices due within", "Paying invoices that are not due for a long time"],
            ["Time between uses", "Splitting one large round into many to get around the other limits"],
            ["Expiry", "A mandate you forgot about staying active forever"],
          ]}
        />
        <P>
          A business can have one live mandate at a time, across all its circles. Activating one also sets a spending approval
          for Salda, equal to the total limit, through a signed permit. Salda can use that approval only through a live mandate,
          and only within its limits.
        </P>
        <H3 id="revoking">Revoking</H3>
        <P>
          Revoking takes effect at once and needs only a signature, so it works with no tokens for gas. It also cancels every
          mandate you signed but never activated. Any round that tries to use a revoked mandate is refused.
        </P>
      </Section>

      <Section id="agent" title="The clearing agent">
        <P>
          The agent is a language model, <Code>openai/gpt-oss-120b</Code> on Groq, that plans rounds for circles whose members
          have mandates. It works only through three tools: it reads the circle, runs Salda’s exact solver, and submits the
          round. Salda then settles it, when every business in it has a mandate, or opens it for the others to sign. It runs on
          demand with <strong className="font-medium">Run clearing now</strong>, and once a day for circles that opt in. Each
          run shows the model’s name and every tool call it made.
        </P>
        <H3 id="agent-can">What it can and cannot do</H3>
        <List>
          <li>It does no arithmetic. Every amount comes from the solver, in exact whole units.</li>
          <li>It holds no money and no keys. The server signs its approval only for a round that passed simulation.</li>
          <li>It never sees a business name or wallet address: businesses appear to it as M1, M2 and so on.</li>
          <li>Its only power is to approve rounds for mandates that name its key, and the contract refuses anything past a limit.</li>
          <li>
            If the model is down or busy, the rules-based agent runs instead, with the same solver and the same checks, and says
            so.
          </li>
        </List>
        <H3 id="compromised">Compromised agent demo</H3>
        <P>
          The demo shows two kinds of attack. In the <strong className="font-medium">simulated compromised agent</strong>, you
          pick a bad round: paying too much for too little, going over the round limit, paying an invoice due in 90 days, or using
          a revoked mandate. The agent signs it and the contract refuses it with the exact error.
        </P>
        <P>
          In the <strong className="font-medium">live prompt injection</strong>, the real model plans a round while one invoice
          carries a note telling it to ignore the mandate. Whether the model resists or is fooled, its round is simulated against
          the deployed contract, which refuses anything past a limit. Neither demo ever sends a transaction, so 0.00 moves.
        </P>
      </Section>
    </>
  );
}

// ========================================================================= guides

function Guides() {
  return (
    <>
      <Section id="using-app" title="Using the app">
        <H3 id="first-circle">Your first circle</H3>
        <List ordered>
          <li>Connect your wallet and switch to the Aevum testnet.</li>
          <li>On <strong className="font-medium">Circle</strong>, choose <strong className="font-medium">Create a circle</strong>, enter its name and your business name, and sign.</li>
          <li>Add each member’s wallet address and business name, and sign each change.</li>
          <li>On <strong className="font-medium">Invoices</strong>, add an invoice you share with a member, sign it, and send them the link.</li>
        </List>
        <H3 id="first-round">Your first round</H3>
        <List ordered>
          <li>On <strong className="font-medium">Rounds</strong>, choose <strong className="font-medium">Plan a round</strong> and set how much cash you can spend.</li>
          <li>Check the graph and the plan, then open the round for everyone to review.</li>
          <li>Each business opens the round, reads what it pays or receives, and signs.</li>
          <li>When everyone has signed, settle it. The receipt links to the transaction on the explorer.</li>
        </List>
      </Section>

      <Section id="judge-demo" title="The judge demo">
        <P>
          The <A href="/demo">demo</A> settles a real round on Aevum in about a minute after you connect. You play Ada’s Bakery;
          Ben’s Farm and Chidi Transport are demo businesses that Salda’s server plays.
        </P>
        <H3 id="demo-steps">Steps</H3>
        <List ordered>
          <li>Connect a wallet on Aevum. You need no test tokens.</li>
          <li>
            Sign once to co-sign the three invoices. Salda creates a circle, records the invoices, and sends you 0.02 tUSD8 to
            spend.
          </li>
          <li>Move the cash slider and watch 0.12, 0.14, then 0.15 clear.</li>
          <li>Sign the round. It settles with one transaction, and the receipt links to the explorer.</li>
          <li>Try the safety checks: the simulated compromised agent, and a live prompt injection against the real AI agent.</li>
        </List>
        <H3 id="demo-scale">Why 1/100 scale</H3>
        <P>
          The testnet faucet gives out only 5 tUSD8 at a time. At 1/100 scale each demo costs at most 0.02 tUSD8, so a small
          reserve covers hundreds of sessions. Free test tokens are limited per wallet, per network and per day. The full-scale
          round, 15.00 cleared with 2.00, is run once and linked as proof.
        </P>
      </Section>

      <Section id="self-host" title="Run your own">
        <H3 id="prerequisites">Prerequisites</H3>
        <List>
          <li>Node.js 24 and npm</li>
          <li>Foundry 1.x (forge, cast)</li>
          <li>Git, with submodules</li>
          <li>Test-only wallets funded from the QDay Discord faucet, for deploying and for the relayer</li>
        </List>
        <H3 id="local">Run locally</H3>
        <CodeBlock label="Clone, build the contracts, and start the app">{`
git clone https://github.com/Dominion116/Salda.git
cd Salda
git submodule update --init

cd contracts
forge build

cd ../web
npm install
cp .env.example .env.local
npm run dev
`}</CodeBlock>
        <P>Without <Code>NEXT_PUBLIC_SALDA_ADDRESS</Code> the app runs on sample data, which is enough to explore every screen.</P>
        <H3 id="deploy">Deploy</H3>
        <CodeBlock label="Deploy the contract and set up the demo (from contracts/)">{`
cp .env.example .env   # set PRIVATE_KEY to a test-only wallet

forge script script/Deploy.s.sol --rpc-url aevum --legacy --broadcast
# prints NEXT_PUBLIC_SALDA_ADDRESS

forge script script/DemoSetup.s.sol --rpc-url aevum --legacy --broadcast
# prints DEMO_ATTACK_CIRCLE and DEMO_ATTACK_INVOICES

node ../tools/export-abi.mjs out ../web/src/chain/abi.ts
`}</CodeBlock>
        <P>
          Then add the values from <A href="#environment">Environment variables</A> to <Code>web/.env.local</Code> and to your
          Vercel project, and deploy <Code>web/</Code>. Verify the contract on the Aevum explorer with{" "}
          <Code>forge verify-contract</Code> and <Code>--verifier blockscout</Code>, as the README shows.
        </P>
        <H3 id="tests">Run the tests</H3>
        <CodeBlock label="Contract and app checks">{`
# contracts/
forge test
forge test --match-path 'test/fork/*' --fork-url aevum
node ../tools/check-shanghai.mjs out

# web/
npm run check   # type check, design tokens, unit tests
`}</CodeBlock>
      </Section>
    </>
  );
}

// ====================================================================== reference

function Reference() {
  return (
    <>
      <Section id="contract" title="Contract">
        <P>
          <Code>SaldaClearing</Code> is one Solidity 0.8.24 contract compiled for the Shanghai EVM, which Aevum runs. Rounds are
          limited to 10 businesses and 30 invoices.
        </P>
        <H3 id="functions">Functions</H3>
        <Table
          caption="SaldaClearing functions"
          head={["Function", "What it does", "Who signs"]}
          rows={[
            [<Code key="1">createCircle</Code>, "Creates a circle with its first members", "The caller, or the admin through the WithSig variant"],
            [<Code key="2">setCircleMember</Code>, "Adds, renames, deactivates or reactivates a member", "The admin"],
            [<Code key="3">registerInvoice</Code>, "Records one invoice", "Both businesses"],
            [<Code key="4">registerInvoices</Code>, "Records up to 30 invoices in one batch", "Every business on them, once each"],
            [<Code key="5">voidInvoice</Code>, "Voids what is left of an invoice", "Both businesses"],
            [<Code key="6">payDirectWithAuthorization</Code>, "Pays part or all of one invoice", "The business that owes"],
            [<Code key="7">settle</Code>, "Settles a round, all or nothing", "Every business in it, or their mandates and the agent"],
            [<Code key="8">activateMandate</Code>, "Stores a standing mandate and applies its permit", "The business"],
            [<Code key="9">revokeMandate</Code>, "Ends a mandate at once", "The business, or WithSig"],
            [<Code key="10">bumpMandateEpoch</Code>, "Cancels every mandate the business signed", "The business, or WithSig"],
          ]}
        />
        <P>
          Reads: <Code>getCircle</Code>, <Code>getCircleMembers</Code> and <Code>getCircleInvoiceIds</Code> (paged),{" "}
          <Code>getInvoice</Code>, <Code>getInvoices</Code>, <Code>getMandate</Code>, <Code>hasLiveMandate</Code>,{" "}
          <Code>hashRound</Code> and <Code>hashMandate</Code>.
        </P>
        <H3 id="signatures">Signatures</H3>
        <P>
          Salda’s own signatures use the EIP-712 domain <Code>SaldaClearing</Code>, version <Code>1</Code>, chain 44005 and the
          contract’s address. Payments use <Code>tUSD8</Code>’s own domain, version <Code>2</Code>.
        </P>
        <Table
          caption="Signature types"
          head={["Type", "Signed by", "Used for"]}
          rows={[
            [<Code key="1">RegisterInvoice</Code>, "Both businesses", "One invoice"],
            [<Code key="2">RegisterInvoiceBatch</Code>, "Every business on the batch", "Up to 30 invoices"],
            [<Code key="3">VoidInvoice</Code>, "Both businesses", "Voiding what is left"],
            [<Code key="4">ApproveRound</Code>, "Businesses that receive or move no cash", "Agreeing to a round"],
            [<Code key="5">ReceiveWithAuthorization</Code>, "Businesses that pay (tUSD8 domain)", "Exactly their net payment, this round only"],
            [<Code key="6">StandingMandate</Code>, "The business", "A mandate’s limits"],
            [<Code key="7">Permit</Code>, "The business (tUSD8 domain)", "The approval a mandate spends from"],
            [<Code key="8">AgentApproval</Code>, "The agent key", "A round that uses mandates"],
            [<Code key="9">RevokeMandate</Code>, "The business", "Revoking without gas"],
          ]}
        />
        <H3 id="errors">Errors</H3>
        <P>The app turns every contract error into a plain sentence. The ones you are most likely to see:</P>
        <Table
          caption="Common contract errors"
          head={["Error", "Meaning"]}
          rows={[
            [<Code key="1">Expired</Code>, "A signature’s time ran out before it was submitted"],
            [<Code key="2">OverClear</Code>, "An invoice changed after the round was planned"],
            [<Code key="3">MissingConsent</Code>, "A business in the round has not agreed"],
            [<Code key="4">RoundAlreadySettled</Code>, "The same round was submitted twice"],
            [<Code key="5">ClearRatioTooLow</Code>, "A mandate would pay too much for the debt it clears"],
            [<Code key="6">ExceedsRoundCap</Code>, "A mandate would pay more than its limit for one round"],
            [<Code key="7">InvoiceDueTooFar</Code>, "An invoice is due later than a mandate allows"],
            [<Code key="8">MandateRevoked</Code>, "The round tried to use a revoked mandate"],
          ]}
        />
      </Section>

      <Section id="api" title="HTTP API">
        <P>
          The app’s server routes. They hold no authority of their own: every write carries signatures that the server checks
          and the contract checks again.
        </P>
        <H3 id="api-format">Request format</H3>
        <P>
          JSON, with every whole-number amount sent as <Code>{`{"$bigint": "123"}`}</Code> so no precision is lost. Errors come
          back as <Code>{`{"error": "A sentence you can act on."}`}</Code> with a 4xx or 5xx status.
        </P>
        <H3 id="api-relay">Relayer</H3>
        <P>
          <Code>POST /api/relay</Code> submits one allowlisted contract call and pays its fee. It simulates first, so a call that
          would fail costs nothing.
        </P>
        <CodeBlock label="Relay a gasless revoke">{`
POST /api/relay
{
  "functionName": "revokeMandateWithSig",
  "args": ["0x5c1d…", { "$bigint": "1795729000" }, "0x8f2a…"]
}

200 OK
{ "hash": "0x3b7e…" }
`}</CodeBlock>
        <P>
          <Code>GET /api/relay</Code> says whether the relayer is available, its address, and the contract it serves.
        </P>
        <H3 id="api-store">Store</H3>
        <P>Holds what waits for another person. Reads are <Code>GET /api/store?kind=…&amp;circleId=…</Code>:</P>
        <Table
          caption="Store reads"
          head={["kind", "Returns"]}
          rows={[
            [<Code key="1">pending</Code>, "Invoices signed by one business, waiting for the other"],
            [<Code key="2">voids</Code>, "Void requests waiting for the other business"],
            [<Code key="3">rounds</Code>, "Rounds in the circle, newest first"],
            [<Code key="4">round</Code>, "One round, with key=roundHash"],
            [<Code key="5">cash</Code>, "Each member’s signed cash limit"],
          ]}
        />
        <P>
          Writes are <Code>POST /api/store</Code> with an <Code>action</Code>: <Code>invoice.propose</Code>,{" "}
          <Code>invoice.cosign</Code>, <Code>void.sign</Code>, <Code>round.open</Code>, <Code>round.consent</Code>,{" "}
          <Code>round.settle</Code>, <Code>cash.set</Code>, <Code>names.set</Code> and <Code>names.get</Code>.
        </P>
        <CodeBlock label="Add your consent to a round">{`
POST /api/store
{
  "action": "round.consent",
  "circleId": { "$bigint": "1" },
  "key": "0x9a41…",
  "consent": {
    "member": "0xA11c…",
    "kind": 0,
    "validAfter": { "$bigint": "0" },
    "validBefore": { "$bigint": "1795729000" },
    "signature": "0x51d0…"
  }
}

200 OK
{ "key": "0x9a41…", "state": "waiting-for-signatures", "positions": [ … ], "consents": { … } }
`}</CodeBlock>
        <H3 id="api-agent">Agent</H3>
        <Table
          caption="Agent routes"
          head={["Request", "Does"]}
          rows={[
            [<Code key="1">GET /api/agent?info=1</Code>, "The agent’s key and ERC-8004 ID (0 if none)"],
            [<Code key="2">GET /api/agent?circleId=1</Code>, "The agent’s recent activity in a circle"],
            [<Code key="3">POST /api/agent</Code>, "Runs the agent now for {\"circleId\": …}"],
            [<Code key="4">GET /api/agent?cron=1</Code>, "The daily scheduled run. Needs the cron secret"],
          ]}
        />
        <H3 id="api-demo">Demo</H3>
        <P>
          <Code>POST /api/demo</Code> runs one step of the judge demo: <Code>start</Code>, <Code>register</Code>,{" "}
          <Code>settle</Code>, <Code>attack</Code> for the simulated compromised agent, or <Code>inject</Code> for the live prompt
          injection. <Code>GET /api/demo</Code> says
          whether the live demo is available.
        </P>
        <H3 id="api-limits">Rate limits</H3>
        <Table
          caption="Rate limits"
          head={["Route", "Limit"]}
          rows={[
            ["Relayer", "10 requests a minute per network address; a daily cap on transactions"],
            ["Store", "120 reads and 30 writes a minute per network address"],
            ["Agent", "60 reads and 5 runs a minute per network address"],
            ["Demo", "20 requests a minute; 5 demos a day per wallet and 10 per network; 2 free top-ups a day per wallet"],
          ]}
        />
      </Section>

      <Section id="environment" title="Environment variables">
        <P>
          Set these in <Code>web/.env.local</Code> and in Vercel. Only variables starting with <Code>NEXT_PUBLIC_</Code> reach
          the browser. Use fresh test-only wallets for every key.
        </P>
        <Table
          caption="Environment variables"
          head={["Variable", "Purpose", "Required", "Secret"]}
          rows={[
            [<Code key="1">NEXT_PUBLIC_SALDA_ADDRESS</Code>, "The deployed contract. Without it, sample data only", "For live data", "No"],
            [<Code key="2">NEXT_PUBLIC_WC_PROJECT_ID</Code>, "WalletConnect, for phone wallets", "No", "No"],
            [<Code key="3">RELAYER_PRIVATE_KEY</Code>, "Pays every relayed fee; holds the demo’s test tokens", "For live data", "Yes"],
            [<Code key="4">AGENT_PRIVATE_KEY</Code>, "The agent’s approval key. Holds no funds", "For mandates", "Yes"],
            [<Code key="5">AGENT_ID</Code>, "ERC-8004 agent ID, or 0", "No", "No"],
            [<Code key="6">AGENT_CIRCLES</Code>, "Circles the daily run covers, comma-separated", "No", "No"],
            [<Code key="7">CRON_SECRET</Code>, "Authenticates the daily run", "For scheduling", "Yes"],
            [<Code key="8">DEMO_BEN_KEY</Code>, "The demo’s Ben", "For the live demo", "Yes"],
            [<Code key="9">DEMO_CHIDI_KEY</Code>, "The demo’s Chidi", "For the live demo", "Yes"],
            [<Code key="10">DEMO_ATTACK_CIRCLE</Code>, "Circle for the compromised agent demo", "For live attacks", "No"],
            [<Code key="11">DEMO_ATTACK_INVOICES</Code>, "Its three invoice IDs", "For live attacks", "No"],
            [<Code key="12">DEMO_DAILY_LIMIT</Code>, "Free top-ups a day, across everyone. Default 100", "No", "No"],
            [<Code key="13">UPSTASH_REDIS_REST_URL</Code>, "The shared store", "On Vercel", "No"],
            [<Code key="14">UPSTASH_REDIS_REST_TOKEN</Code>, "The shared store’s token", "On Vercel", "Yes"],
            [<Code key="15">TRUSTED_IP_HEADER</Code>, "Header with the real visitor address. x-vercel-forwarded-for on Vercel", "On Vercel", "No"],
            [<Code key="16">RELAYER_DAILY_TX_LIMIT</Code>, "Most relayed transactions a day. Default 500", "No", "No"],
            [<Code key="17">GROQ_API_KEY</Code>, "Turns on the AI agent. Without it, the rules-based agent runs", "For the AI agent", "Yes"],
            [<Code key="18">GROQ_MODEL</Code>, "The model on Groq. Default openai/gpt-oss-120b", "No", "No"],
            [<Code key="19">AI_DAILY_LIMIT</Code>, "Most AI agent runs a day, across everyone. Default 300", "No", "No"],
          ]}
        />
      </Section>

      <Section id="network" title="Network facts">
        <Table
          caption="QDay Aevum testnet"
          head={["Item", "Value"]}
          rows={[
            ["Chain ID", "44005"],
            ["RPC", <Code key="rpc">https://rpc-test.qday.info</Code>],
            ["Explorer", <A key="exp" href="https://explorer-test.qday.info">explorer-test.qday.info</A>],
            [
              "SaldaClearing",
              <A key="salda" href="https://explorer-test.qday.info/address/0x25B0746b1C7DDb7D585855eE03bF7589A14cB5FA?tab=contract">
                0x25B0746b1C7DDb7D585855eE03bF7589A14cB5FA (verified source)
              </A>,
            ],
            ["tUSD8", <Code key="t">0x456569838f1d43009A91ebA4263147Afd7233483</Code>],
            ["Multicall3", <Code key="m">0xcA11bde05977b3631167028862bE2a173976CA11</Code>],
            ["EVM version", "Shanghai"],
            ["Block time", "About 1 second"],
            ["Log queries", "At most 1,000 blocks per request, so Salda reads lists from the contract instead"],
          ]}
        />
      </Section>
    </>
  );
}

// ========================================================================== trust

function Trust() {
  return (
    <>
      <Section id="security" title="Security model">
        <P>
          Salda is built so that no single party, Salda included, can move a business’s money without that business’s
          signature or its mandate.
        </P>
        <H3 id="trusted">Who you trust</H3>
        <List>
          <li>The contract, which is open source but not audited.</li>
          <li>Your circle’s admin, for the business names they confirm.</li>
          <li><Code>tUSD8</Code>’s issuer, who can pause transfers or block an address. A blocked member stops a whole round.</li>
        </List>
        <H3 id="not-trusted">Who you do not</H3>
        <List>
          <li>The relayer: it only submits what you signed, and anyone else can submit the same signatures.</li>
          <li>The solver: the contract rechecks every round it proposes.</li>
          <li>The agent: it can approve rounds only inside your mandate’s limits, and you can revoke it at any time.</li>
          <li>The store: it holds signatures waiting for others, and losing it loses only rounds that were not yet submitted.</li>
        </List>
      </Section>

      <Section id="privacy" title="Privacy model">
        <P>On a public blockchain, some things are visible to everyone. Salda keeps the rest out of it.</P>
        <Table
          caption="What is public and what is not"
          head={["Information", "Where it lives"]}
          rows={[
            ["Wallet addresses, who owes whom, and amounts", "Public onchain"],
            ["Business and circle names", "Onchain only as salted hashes. Names are shown only to active members"],
            ["Invoice documents", "Never uploaded. Onchain only as a salted hash"],
            ["Cash limits and waiting signatures", "Salda’s store, until used or expired"],
          ]}
        />
        <P>
          Read the <A href="/privacy">privacy policy</A> for what the website itself collects. Using a separate wallet for each
          circle makes it harder to link your activity across circles.
        </P>
      </Section>

      <Section id="constraints" title="Known constraints">
        <List>
          <li>Amounts and addresses are public. Amount privacy is on the roadmap, not in this version.</li>
          <li>Gasless use depends on the relayer being up. Anyone with tQDAY can submit the same signed round instead.</li>
          <li>Rounds are all or nothing: one missing signature, or one blocked member, stops the whole round.</li>
          <li>With mandates, the solver uses a heuristic step that may miss the very best plan. The contract still enforces every limit.</li>
          <li>Test tokens only. Nothing here has real value.</li>
        </List>
      </Section>

      <Section id="faq" title="Questions">
        <H3 id="faq-silent">What if a business never signs?</H3>
        <P>
          The round does not settle and nothing moves. Plan a new round without that business’s invoices, or wait. Signatures
          expire, so an old round cannot be pushed through later.
        </P>
        <H3 id="faq-custody">Does Salda ever hold my money?</H3>
        <P>
          Only for the instant of a settlement: payments come in and go out in the same transaction, and the contract checks
          that it ends with exactly what it started with.
        </P>
        <H3 id="faq-agent">Why have an agent at all?</H3>
        <P>
          So rounds can happen regularly without every business being online to sign. Mandates keep that safe: the agent can
          only do what each business allowed.
        </P>
        <H3 id="faq-legal">Is set-off legal where I am?</H3>
        <P>
          It depends on the country, and this prototype has not had legal review. That review is part of the path to mainnet.
        </P>
      </Section>
    </>
  );
}
