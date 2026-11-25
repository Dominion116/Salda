# Salda — Product Requirements & Technical Specification (PRD)

**Hackathon:** Aevum Builder Challenge #1 (QDay.io / DoraHacks)  
**Track:** Invoice Payments *(also touches Native AI Assistants through agent guardrails and Confirmation of Payee through circle name attestation)*  
**Target Chain:** QDay Aevum Testnet (`chainId = 44005` / `0xABE5`)  
**Settlement Asset:** `tUSD8` (`0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals)  
**Build Baseline:** Solo builder (`8 GB RAM`, limited bandwidth; new public MIT repository unrelated to `Floe`)

---

## 1. Executive Summary & Positioning

### 1.1 Product Name & Identity
* **Name:** **Salda** (`SAHL-dah`) — single non-compound root from Latin *solidus* ("made whole / squared") → Italian *saldare* / Spanish & Portuguese *saldar* (*salda* = "settles / clears / squares the account"), sibling of *saldo* (net balance across European accounting).
* **One-Line Pitch:** *"Three shops owe each other 15 tUSD8. Salda clears all of it with 2 tUSD8. With no cash at all, it still clears 12."*
* **Core Expansion Rule:** Add **only** what makes multilateral clearing work better (cash-limited optimization, standing mandates, an untrusted clearing agent, and invite-only trading circles with name attestation). Zero unrelated features.

### 1.2 Competition Check
* A GitHub search of names, descriptions, and READMEs found `206` public repositories mentioning `tUSD8`; **none** also matched "netting", "clearing", or "multilateral". Private repositories and entries worded differently are not visible to this search, so recheck GitHub and the DoraHacks entries before submitting. Existing entries cluster around single-invoice checkout, escrow, streaming, and Confirmation-of-Payee checks.
* **Prior Art & Differentiation:**
  * Openly cite **Cycles Protocol** (Informal Systems, *arXiv:2507.22309* — Ethan Buchman, Paolo Dini, Shoaib Ahmed, Andrew Miller & Tomaž Fleischman), academic clearing research (*Multilateral Clearing on Invoice Graphs: Path Enabled Compensation Versus Cycle Restricted Netting*, *arXiv:2606.26126*; *Clearing Sections of Lattice Liability Networks*, *arXiv:2503.17836*), real-world mutual-credit networks (**Sardex**, **WIR Bank**, **Sarafu**), and Renaissance clearing fairs (**Lyons** *virement des parties*, **Bisenzone** *scontro*/*riscontro*).
  * **How Salda differs:** Non-custodial, zero-escrow atomic settlement directly in native `tUSD8` on Aevum Testnet (no trusted TEE, no pooled collateral, no IOUs issued) paired with **contract-enforced standing mandates** carrying a **minimum clear ratio** guardrail.

### 1.3 Business Model & Path to Mainnet
Everything in this section is a hypothesis to test with real trade groups, not a validated claim. Say so in the pitch.
* **Who it is for first:** groups that already trade in circles: cooperatives, market trader associations, wholesaler networks, and subsidiaries of one company.
* **Who pays:** the circle operator (association, cooperative, or finance team). Members use it free, because more members means more debt that can clear.
* **Pricing to test:** free for small circles; a flat monthly subscription for larger ones that adds scheduled rounds, statements, and bookkeeping exports. Any price shown is labelled an assumption. Fees stay **outside the contract**, so `totalPulled == totalPaid` always holds.
* **Value to show:** debt cleared, cash actually used, and cash members did not have to find (`grossCleared - netCashMoved`). These come from on-chain rounds.
* **Distribution:** one operator brings a whole group. Start with one or two pilot circles, then reach similar groups through accountants, bookkeepers, and trade associations.
* **Path to mainnet:** (1) pilot circles on testnet; (2) independent security audit; (3) legal review of multilateral set-off in each target country; (4) stronger amount privacy; (5) mainnet deployment through the QDay builder program with an available mainnet stablecoin.

---

## 2. Verified Platform & Environment Facts (Aevum Testnet)

Empirical checks against `https://rpc-test.qday.info`, `https://explorer-test.qday.info/api/v2/stats`, and `qday-io/aevum-starter-kit` established the following hard constraints:

| Parameter | Verified Value / Behavior | Engineering Implication for Salda |
|---|---|---|
| Chain ID / RPC | `44005` (`0xABE5`) / `https://rpc-test.qday.info` | HTTPS only (no WebSocket RPC); poll over HTTP. |
| Block time / Gas price | **~1.02 s/block** (`1020 ms`) / **1.0 gwei** (`tQDAY`) | `1 tQDAY` covers thousands of settlements. Send `type: "legacy"` (`--legacy`) transactions. Claim "about 1 second per block" only: QDay describes sub-second settlement as a mainnet design goal. |
| EVM version | **Shanghai** | Keep `solc_version = "0.8.24"`, `evm_version = "shanghai"` in `foundry.toml`, and run `tools/check-shanghai.mjs` on every build. **Never** use `MCOPY`, `TLOAD`, `TSTORE`, `BLOBHASH`, `BLOBBASEFEE`, or OpenZeppelin `*Transient` contracts (`ReentrancyGuardTransient`). |
| `tUSD8` contract | `0x456569838f1d43009A91ebA4263147Afd7233483` (`6` decimals) | ZeppelinOS `FiatTokenProxy` (`impl = 0xd6be708f41b07b2f4a7b48889b8e16626e317597`). EIP-712 domain: `name: "tUSD8"`, `version: "2"`, `chainId: 44005` (`DOMAIN_SEPARATOR = 0x7838e6c46f8f9874236c9747d9896552a03d22c7c3e701b198879de2cb658022`). |
| `tUSD8` signature standards | Live bytecode verified for **both EIP-2612 & EIP-3009** | `permit()`, `nonces()`, `PERMIT_TYPEHASH`, `receiveWithAuthorization` (`(v,r,s)` and `(bytes)`), `transferWithAuthorization`, `cancelAuthorization`, `authorizationState` all exist on-chain. `isBlacklisted()` and `paused()` also exist: check both before every round (see Section 8). |
| Starter kit `MockUSD8.sol` | **Gap:** EIP-3009 only (no `permit()` / `nonces()`) | Salda's local `MockUSD8.sol` **must add EIP-2612 `permit` + `nonces`** (same `"tUSD8"`, `"2"` domain) so Tier 2 standing mandate tests run without network forks. |
| `eth_getLogs` limit | Max **1,000 blocks** per call (`MAX_LOG_RANGE = 1000n`) | At `1.02s`/block, 1,000 blocks is only **~16.6 minutes**. Never scan `getLogsChunked` from deploy block in the browser. Store enumerable circle/invoice/round lists on-chain behind **paginated getters** (`offset`, `limit`) and read pages in batched `Multicall3` calls (`0xcA11bde05977b3631167028862bE2a173976CA11`, live on Aevum). |
| Explorer verification | `forge verify-contract` currently unavailable | Publish exact deployed addresses, constructor args, ABI, and exact commit SHA in `README.md`. |
| Account Abstraction | No official ERC-4337 bundler/paymaster on Aevum | Use gasless relayer + EIP-3009 / EIP-2612 signed by the user's own wallet through RainbowKit; no guest accounts; keep ERC-4337/passkeys out of scope. Describe the mandate's agent key as a **scoped session key** (limits, expiry, instant revoke). Do not call it a smart account. |
| ERC-8004 agent identity | Named in the rules as QDay infrastructure. An `AgentIdentity` registry (`AGENT`, version `2.0.0`, about 1,800 agents, unverified source) exists at `0xF45E7f39Caba1d2055f613970575a7e7069636Be`. | **Pending Discord confirmation** that this is the registry QDay expects. Do not call it official before then. Registry address is a constructor setting that can be zero (feature off). |
| Faucet allocation | Discord `/faucet`: **1 tQDAY + 5 tUSD8** per Discord/address | Run the sandbox at **1/100 scale** (`0.15 tUSD8` cleared with `0.02`). A `6 tUSD8` reserve then covers about `300` sessions even if nothing is ever recovered. The full-scale `15 -> 2` round is run once and linked as proof. |

---

## 3. Target Users & Core User Journeys

1. **Trade Circle Admin (Circle Operator):** Creates an invite-only trading circle, adds member wallet addresses, and attests each member's legal/shop business name through an on-chain salted hash, so peers see a checked counterparty name before signing without the name being public.
2. **Circle Member (Shop / SME):**
   * Co-signs bilateral EIP-712 invoices (`registerInvoice`), optionally voids unsettled invoices (`voidInvoice`), or settles one directly anytime (`payDirectWithAuthorization`). Two members on different devices co-sign through the pending-item store (Section 5.4).
   * **Tier 1 mode:** Signs manual gasless round consent (`receiveWithAuthorization` if net debtor; EIP-712 `ApproveRound` if net creditor or net-zero).
   * **Tier 2 mode:** Signs one standing mandate (EIP-2612 `permit` if `maxNetDebitPerRound > 0` + EIP-712 `StandingMandate`), activates it on-chain through the relayer, adjusts their round **cash budget slider**, and revokes instantly with a gasless signature if needed.
3. **Clearing Agent (Untrusted Proposer / Executor):** Collects active circle invoices, cash limits, and mandates; solves the cash-limited clearing plan; explains every member's pre/post position in plain English; signs an EIP-712 `AgentApproval` over the round; the relayer submits `settle()`. Cannot move a single unit outside contract-verified rules.
4. **Hackathon Judge / First-Time Visitor:** Opens the public URL, plays with the **live clearing graph** on the landing page with no wallet, then opens `/demo`, connects a wallet through RainbowKit (adding Aevum if prompted), drags the **Cash Slider** (`0` → `0.01` → `0.02 tUSD8`), sees the graph jump from `0.12` → `0.14` → `0.15 tUSD8` cleared, signs twice, executes a real settlement on Aevum Testnet, and opens the `explorer-test.qday.info` receipt in **under 60 seconds after connecting**. No faucet visit and no gas needed.

---

## 4. Functional Requirements by Tier

### 4.1 Tier 1 — Base Clearing Protocol (Must Ship)

#### Smart Contract (`SaldaClearing.sol`)
Hard round limits: **`MAX_MEMBERS_PER_ROUND = 10`**, **`MAX_INVOICES_PER_ROUND = 30`**. All monetary amounts are integer `uint256` in `6`-decimal `tUSD8` base units (`1 tUSD8 = 1_000_000`).

**EIP-712 domain:** every Salda signature uses `name: "SaldaClearing"`, `version: "1"`, `chainId: block.chainid`, `verifyingContract: address(SaldaClearing)`. It is separate from the `tUSD8` domain (`"tUSD8"`, `"2"`) used for EIP-2612 and EIP-3009.

**Gasless rule:** every action a member or circle admin can take must have a signed variant the relayer can submit. A variant that can be replayed carries a nonce or epoch, and every variant carries a `deadline`.

**Circles (basic, Tier 1):**
   * `createCircle(circleNameHash, members[], nameHashes[])` and `createCircleWithSig(...)`: caller or signer becomes circle admin and initial members are added in the same transaction.
   * `setCircleMember(circleId, member, active, nameHash)` and `setCircleMemberWithSig(...)`: admin only.
   * **Names never go on-chain in plain text.** `nameHash = keccak256(abi.encode(member, name, salt))` with a random 32-byte `salt`. Name and salt stay in the shared store (Section 5.4).
   * Deactivating a member blocks new invoices. It does not block settling debts that already exist, which still need that member's consent.

1. **`registerInvoice(InvoiceInput calldata inv, bytes calldata debtorSig, bytes calldata creditorSig) -> uint256 invoiceId`** and batch `registerInvoices(...)` (up to 30)
   * Batch signing: every party signs the same readable EIP-712 `RegisterInvoiceBatch(RegisterInvoice[] invoices, deadline)`. The contract requires each invoice's debtor and creditor to be among the recovered signers. One wallet prompt can therefore co-sign several invoices.
   * Fields stored on-chain: `circleId`, `debtor`, `creditor`, `amount`, `cleared` (`0`), `dueDate`, `registeredAt`, `docHash`, `voided` (`false`).
   * Validation: `amount > 0`, `debtor != address(0)`, `creditor != address(0)`, `debtor != creditor`, `dueDate > 0`, and **both `debtor` and `creditor` are active members of `circleId`**.
   * Privacy: `docHash = keccak256(abi.encode(documentHash, docSalt))` with a random `docSalt`, so a short or predictable invoice cannot be guessed from its hash.
   * Replay protection: EIP-712 `RegisterInvoice(circleId, debtor, creditor, amount, dueDate, docHash, salt, deadline)` signed by **both** `debtor` and `creditor`; `block.timestamp <= deadline`; `usedRegisterSalt[keccak256(...)]` marked consumed.
   * Indexing: Append `invoiceId` to circle's enumerable list, read through a paginated getter and `Multicall3`.

2. **`voidInvoice(uint256 invoiceId, uint256 deadline, bytes calldata debtorSig, bytes calldata creditorSig)`**
   * Requires both debtor and creditor EIP-712 `VoidInvoice(invoiceId, remainingAmount, deadline)` signatures (or one direct `msg.sender` + counterparty signature).
   * Marks `inv.voided = true` so remaining `amount - cleared` can never be cleared or paid. Reverts if already voided or fully cleared (`cleared == amount`).

3. **`payDirectWithAuthorization(...)`**
   * EIP-3009 only. There is deliberately no allowance-based `payDirect`, because it would spend the ERC-20 allowance a standing mandate depends on.
   * Submitted by the debtor or the relayer anytime (with the debtor's EIP-3009 `receiveWithAuthorization` nonce bound to `keccak256(abi.encode(address(this), "DIRECT", invoiceId, payAmount, directNonce))`).
   * Checks `!inv.voided`, `payAmount > 0`, `inv.cleared + payAmount <= inv.amount`; increments `inv.cleared` before transferring `payAmount` directly to `inv.creditor`.

4. **`settle(RoundInput calldata round, ConsentInput[] calldata consents, AgentApproval[] calldata agentApprovals)`**
   * **Anyone may submit.** Authority comes from signatures, never from `msg.sender`. `agentApprovals` is empty for rounds with manual consent only.
   * **Never trusts the solver or caller.** Recomputes and enforces every invariant atomically (all-or-nothing) under OpenZeppelin `ReentrancyGuard`:
     * **Bounds & Duplicate Guard:** `block.timestamp <= round.deadline`; `1 <= round.invoiceIds.length <= 30`; `round.invoiceIds.length == round.clearAmounts.length`; **`round.invoiceIds[i] > round.invoiceIds[i - 1]` strictly ascending** (O(1) guarantee that no invoice ID appears twice in one round).
     * **Invoice Updates (Checks-Effects):** For each `(id, x)`: `!inv.voided`, `inv.circleId == round.circleId`, `x > 0`, `inv.cleared + x <= inv.amount`; updates `inv.cleared += x` immediately.
     * **Net Position Accounting:** Accumulates `outTotal[m]` (sum of `x` where `m == debtor`) and `inTotal[m]` (sum of `x` where `m == creditor`) over unique touched members (`<= 10`).
     * **Round Hash & Replay Prevention:**  
       `roundHash = keccak256(abi.encode(address(this), block.chainid, round.circleId, round.roundNonce, round.deadline, round.invoiceIds, round.clearAmounts))`  
       Checks `!usedRoundHashes[roundHash]` and marks `usedRoundHashes[roundHash] = true`.
     * **Consent Enforcement (Fixes the Net-Zero Trap):**  
       Every touched participant `m` must match one consent entry:
       * If `outTotal[m] > inTotal[m]` (**Net Debtor**, `netDebit = outTotal[m] - inTotal[m]`):
         * *Manual EIP-3009:* calls `tUSD8.receiveWithAuthorization(m, address(this), netDebit, validAfter, validBefore, keccak256(abi.encode(address(this), roundHash, m)), v, r, s)`.
         * *Or Tier 2 Mandate:* validates standing mandate & pulls `netDebit` via `safeTransferFrom`.
       * If `outTotal[m] <= inTotal[m]` (**Net Creditor OR Net-Zero Participant** — critical for zero-cash pure cycles like `A->B 4, B->C 4, C->A 4` where every member has `net == 0`!):
         * *Manual EIP-712:* verifies EIP-712 `ApproveRound(roundHash, m, outTotal[m], inTotal[m])` signed by `m`.
         * *Or Tier 2 Mandate:* validates standing mandate (without requiring an ERC-20 `permit` allowance since `netDebit == 0`).
     * **Atomic Cash Conservation:** Pulls all `netDebit > 0` first, pushes all `netCredit = inTotal[m] - outTotal[m] > 0` to creditors, and explicitly asserts `totalPulled == totalPaid` so contract `tUSD8` balance change across `settle()` is always `0`.

#### Tier 1 Web Application (`web/`)
* **Wallet Connection:** RainbowKit (wagmi + viem), including WalletConnect for mobile wallets. **No guest accounts and no browser-generated user keys.** Connecting prompts the user to add or switch to Aevum (`44005`). Users need no `tQDAY` for relayed actions.
* **Before/After Debt Graph:** Visual directed graph rendering gross open invoices (edges before) vs. settled cycle cancellations and net `tUSD8` transfers (after).
* **Receipt Page:** Shows cleared invoices, per-member net breakdown, compression ratio (`grossCleared / netCashMoved`), and clickable `https://explorer-test.qday.info/tx/<hash>` link.
* **One-Click Judge Sandbox:** Pre-loaded 3-shop circular ledger (`A->B 0.06`, `B->C 0.05`, `C->A 0.04`, a 1/100 scale of the headline case) at `/demo`, executable end-to-end on live Aevum Testnet in `< 60 seconds` **after the wallet is connected**, on desktop or mobile, without requesting faucet tokens. The clearing graph on the landing page needs no wallet.
* **Accessibility:** every action works by keyboard with visible focus; controls have labels; text contrast meets WCAG AA; status changes are announced to screen readers; nothing depends on color alone; animations respect reduced-motion settings. The debt graph has a **text table version** with the same information, and the cash slider also accepts a typed number.
* **Plain-language states:** every action shows what is being signed, what will move, current status, and errors a non-crypto user understands.

---

### 4.2 Tier 2 — Target Expansion

#### 1. Cash-Limited Clearing Solver (`packages/solver/`) & Cash Slider
* **Optimization Problem:** Given open invoices $e = (u \to v)$ with remaining capacity $c_e = \text{amount}_e - \text{cleared}_e \in \mathbb{Z}_{\ge 0}$ and member cash limits $b_v \in \mathbb{Z}_{\ge 0}$ (in integer 6-decimal units):
  $$\max \sum_e x_e \quad \text{s.t.} \quad 0 \le x_e \le c_e,\quad \text{out}(v) - \text{in}(v) \le b_v \;\;\forall v$$
* **Exact Graph Reduction (Min-Cost Circulation):**
  * Add one virtual cash hub $S^*$.
  * For each open invoice $e = (u \to v)$: directed edge $u \to v$ with capacity $c_e$ and cost `W_INVOICE = -1000n`.
  * For each member $v$: cash-in edge $S^* \to v$ with capacity $b_v$ and cost `+1n` (only spend cash when it strictly clears more debt; among equal-debt plans, **strictly minimize cash moved**), and cash-out edge $v \to S^*$ with capacity $\infty$ and cost `0n`.
  * Run SPFA / Bellman-Ford negative-cycle canceling in `BigInt`. By the **Integrality Theorem of Network Flows**, integer capacities guarantee an **exact integer solution in 6-decimal units**.
  * **Iteration guard:** cap cycle-canceling iterations. Any intermediate flow is already feasible, so if the cap is reached, return it and mark the plan "not proven optimal". Benchmark at `N = 10, E = 30` with realistic 6-decimal amounts before publishing any speed claim.
* **Mandate Ratio-Aware Layer:**
  * Because `minClearRatio` ($R_v \cdot (\text{out}_v - \text{in}_v) \le \text{out}_v$) couples inflows and outflows at vertex $v$, pure min-cost circulation can violate a strict ratio (e.g., `A->B 10, B->A 2` with `A` mandate `3x`: flow `[10, 2]` gives `10 / 8 = 1.25x`, whereas the valid optimum is `[3, 2]` clearing `5` with `A` paying `1` at `3.0x`).
  * **Limit-tightening method (no linear programming):**
    1. Run `BigInt` min-cost circulation with $b_v = \min(\text{cash}_v, \text{roundCap}_v, \text{remainingTotalCap}_v)$. If all active mandate ratios hold, return immediately.
    2. Otherwise, for each violating member, binary search in 6-decimal units for a lower $b_v$ at which the ratio holds, then re-solve and recheck every member. Repeat for at most `N` passes.
    3. Fallback: set $b_v = 0$ for any member still violating, then re-solve and recheck until none remain. Net debit becomes `0`, so the ratio rule no longer applies and the result is always feasible.
  * **Quality:** this is a heuristic, not a proof. In a prototype check on 500 small random graphs (3 to 4 members, 5 invoices), it matched the brute-force optimum every time and was never infeasible. The contract enforces every ratio regardless.
* **Mandatory Solver Check Case (`A->B 6`, `B->C 5`, `C->A 4`, `B_cash = 0`, `C_cash = 0`):**
  * `A_cash = 2` → clears `[6, 5, 4] = 15` (`A` pays `2`, `B` `+1`, `C` `+1`)
  * `A_cash = 1` → clears `[5, 5, 4] = 14` (`A` pays `1`, `B` `0`, `C` `+1`)
  * `A_cash = 0` → clears `[4, 4, 4] = 12` (`A, B, C` all `0`)
* **UI Moment:** Interactive **Cash Slider** per member (`0.00` to `0.02 tUSD8` in the sandbox) that re-solves client-side in real time and previews exact cleared edges and net cash flows before submission.

#### 2. Standing Mandates (Non-Blocking Recurring Rounds)
* **One-Time Setup:** Member signs:
  1. **EIP-2612 `permit`** (`owner = member`, `spender = SaldaClearing`, `value = totalCap`, `deadline = expiry`) — *omitted if `maxNetDebitPerRound == 0`*.
  2. **EIP-712 `StandingMandate`**:
     * `circleId`: `uint256`
     * `member`: `address`
     * `agent`: `address` (key whose `AgentApproval` signature is required; it does not need to be the transaction sender)
     * `agentId`: `uint256` (ERC-8004 agent ID, `0` if unused)
     * `maxNetDebitPerRound`: `uint256`
     * `totalCap`: `uint256`
     * `maxDueDays`: `uint32` (debtor invoices must have `inv.dueDate <= block.timestamp + uint256(maxDueDays) * 1 days`)
     * `minClearRatioBps`: `uint32` (e.g., `30_000` = at least `3.0x` debt cleared per `1` cash paid out; `0` disables)
     * `minCooldown`: `uint32` (minimum seconds between mandate uses by this member, mitigating round-splitting attacks; `0` in fast sandbox)
     * `expiry`: `uint64`
     * `mandateNonce`: `uint64` (must match current `memberMandateEpoch[member]`)
* **Activation:** `activateMandate(StandingMandate m, bytes memberSig, PermitInput permit)`, submitted by the member or the relayer, verifies the signature and epoch, requires `member` to be active in `circleId`, applies the permit, and stores the mandate on-chain. `settle()` reads the stored mandate, so nothing about a mandate depends on an off-chain database.
* **One active mandate per member, across all circles.** Activation reverts (`MandateAlreadyActive`) while another is active and unexpired. Reason: `tUSD8` keeps a single allowance per spender and a new `permit` overwrites the old one. To change terms, revoke first, then activate.
* **No stale activations:** every revoke also advances `memberMandateEpoch[member]`, and a mandate hash can be activated only once. Otherwise anyone could activate an older signed mandate after the member revoked the current one.
* **On-Chain Guardrails & Security Fixes:**
  * **Agent authorization:** every mandate used in a round needs a valid EIP-712 `AgentApproval(roundHash, agent)` signature from that mandate's `agent`. One approval covers all mandates naming the same agent. The relayer's address grants no authority.
  * **Agent identity (ERC-8004, pending Discord confirmation):** if a registry is configured and `agentId != 0`, `activateMandate` requires `agent` to be that ID's owner or registered agent wallet. `settle()` never calls the registry, so a registry outage or change cannot block or alter settlement. The mandate pins the `agent` key: transferring the ID later does not give the new owner any mandate.
  * **Checks on every mandate use:** active, epoch current, not expired, `circleId` matches the round, agent approval valid, cooldown elapsed, per-round cap, total cap (`mandateSpent[mandateHash]`), due-date window on every invoice where the member is debtor, and clear ratio.
  * **Front-running resilience:** In `activateMandate`, call `try IERC20Permit(token).permit(...) {} catch {}` so a mempool observer pre-submitting `permit` cannot block activation, then require `allowance >= totalCap` when `maxNetDebitPerRound > 0`.
  * **Exact integer ratio check:** If `netDebit > 0 && minClearRatioBps > 0`, require `outTotal * 10_000 >= netDebit * uint256(minClearRatioBps)`.
  * **Instant Revocation:** `revokeMandate(bytes32 mandateHash)` revokes the active mandate; `bumpMandateEpoch()` invalidates the active mandate and every signed but unused mandate for `msg.sender` in O(1). Both have signed variants (`revokeMandateWithSig`, `bumpMandateEpochWithSig`) so a member with no gas can revoke. Any allowance left in `tUSD8` cannot be pulled by Salda without an active mandate; the UI also offers to set it to `0`.

#### 3. Clearing Agent + Compromised-Agent Rejection Demo
* **Scheduled / Triggered Round Runner:** Next.js API/cron worker reads circle state via `Multicall3`, gathers active mandates (on-chain) + member cash caps (pending-item store), filters eligible invoices (`dueDate` within mandate horizons), executes the solver, produces a plain-language summary per shop (e.g., *"Shop A clears 6 tUSD8 of payables and collects 4 tUSD8 of receivables, paying 2 tUSD8 net — 3.0x savings ratio"*), signs `AgentApproval`, and submits `settle()` through the relayer.
* **Identity (pending Discord confirmation):** register Salda's agent in the confirmed ERC-8004 registry, with a registration file stating what it does and its limits. Show the agent ID on mandate screens and receipts. If the registry is not confirmed, ship with `agentId = 0` and list it as roadmap.
* **Scheduling:** check the hosting plan's cron limits before relying on it. A **Run clearing now** button is always available.
* **Explanations:** built from templates and exact solver numbers, so they work with no AI model. If a language model is added, it only rewords the template text, the UI names the model, and it never sees a key, builds a round, or signs.
* **Least-Privilege Guarantee:** The agent holds zero token custody and zero arbitrary call power; it can only approve rounds bounded by member signatures and mandate limits.
* **Compromised-Agent Rejection Demo (Required Showcase):**
  * Interactive UI demo labelled **"Simulated compromised agent"**. The judge picks an attack (ratio too low, round cap exceeded, invoice due too far ahead, revoked mandate) and the app builds and agent-signs that bad round. Do not describe it as live prompt injection unless a real model is wired in and named.
  * Simulating that round against `SaldaClearing` triggers a deterministic on-chain revert (`ClearRatioTooLow` / `ExceedsRoundCap` / `InvoiceDueTooFar` / `MandateRevoked`), which the UI displays with the exact revert trace and a clear confirmation that **0 tUSD8 moved**.

#### 4. Trading Circle Payee Attestation
Circle creation and membership ship in Tier 1. Tier 2 adds the payee-check experience:
* The app fetches a member's name and salt (e.g., `"Kora Bakery Ltd"`), recomputes the hash, and compares it with the on-chain `nameHash`. A mismatch or missing name shows **"unverified name"**.
* Renaming a member emits `MemberNameChanged` (hashes only) and stores `nameUpdatedAt`. If it is later than an invoice's `registeredAt`, the UI shows a **name changed** warning before any signature.
* The name is only as trustworthy as the circle admin. State this in the UI.
* UI displays the admin-attested business name alongside the shortened `0x` address before any invoice co-sign, mandate approval, or round settlement (lightweight Confirmation-of-Payee anti-spoofing).

---

### 4.3 Tier 3 — Stretch Goals (Only After Tier 2 Passes)
1. **CSV Invoice Import** (client-side CSV parser that stages many co-sign links at once; single co-sign links are already in Tier 1, Section 5.4).
2. **Downloadable Netting Statement** (CSV/PDF-ready per-member round accounting summary: gross AP cleared, gross AR collected, net `tUSD8` cash, tx hash).
3. **Early-Payment Discount on `payDirectWithAuthorization` Only** (optional basis-point discount before `dueDate`, strictly excluded from multilateral `settle` cycles).

---

### 4.4 Explicit Non-Goals (Documented as Future Roadmap in `README.md`)
Do **not** build:
* Liquidity pool / credit backstop for cash-short members
* Tokenized/fractionalized invoices (ERC-1155/ERC-721 receivables)
* Zero-knowledge privacy (state explicitly that wallet addresses, who owes whom, and amounts are public on-chain; business names, circle names, and invoice documents appear only as salted hashes)
* Protocol fees inside the contract
* ERC-4337 Account Abstraction, WebAuthn passkeys, ML-DSA post-quantum signatures, x402 HTTP paywalls, or multi-currency netting.

---

## 5. Relayer, Sandbox, Pending Items & Starter-Kit Reuse

### 5.1 Gasless Relayer (`web/src/app/api/relay/route.ts`)
Adapt the starter kit's `relay/route.ts` rails for `SaldaClearing`:
* **Strict allowlist:** Only calls `settle`, `registerInvoice(s)`, `voidInvoice`, `payDirectWithAuthorization`, `createCircleWithSig`, `setCircleMemberWithSig`, `activateMandate`, `revokeMandateWithSig`, and `bumpMandateEpochWithSig` on configured `SaldaClearing` addresses, plus two fixed `tUSD8` calls: the sandbox seed transfer and a member-signed `permit` setting Salda's allowance to `0`. Never relays arbitrary targets/calldata.
* **Simulate-before-send:** Run `publicClient.simulateContract(...)` before spending `tQDAY`, returning plain-English errors via `explain(e)`.
* **Legacy txs:** Always send with `type: "legacy"` and `nonceManager`.
* **Shared rate limits:** Move in-memory `hits`, `sentToday`, and `inFlight` tracking out of serverless process memory into Upstash Redis before public deploy, using `TRUSTED_IP_HEADER=x-vercel-forwarded-for`.

### 5.2 Judge Sandbox at `/demo` (1/100 Scale)
To respect the `5 tUSD8` Discord faucet limit while delivering live on-chain Aevum receipts to judges on mobile:
1. Sandbox treasury holds a small reserve (e.g., `6 tUSD8` + `1 tQDAY`).
2. The judge connects their own wallet through RainbowKit and plays `Shop A`. `Shop B` and `Shop C` are server-held wallets, clearly labelled **demo counterparties**, reused across sessions.
3. Clicking **Start live demo** asks the judge for one signature (`RegisterInvoiceBatch`), which co-signs the invoices and proves wallet ownership. The server signs for B and C, creates a fresh circle, registers the three invoices in one batch, and seeds the judge's wallet with `0.02 tUSD8`. The relayer pays all gas.
4. The judge slides `Shop A` cash (`0` → `0.01` → `0.02`), watches live solver output (`0.12` → `0.14` → `0.15 tUSD8`), clicks **Settle on Aevum**, and reviews and signs Shop A's round consent. **Two wallet prompts in total**, plus adding the network if needed. The judge receives the real `explorer-test.qday.info` tx link.
5. **No recovery needed:** each session costs at most `0.02 tUSD8`, so `6 tUSD8` covers about `300` sessions. The server holds B's and C's keys and can return their balances to the treasury at any time. Anything left in Shop A is treated as spent.
6. Seed only after a valid signature. Limit seeds per wallet and per IP, plus a global daily cap, in Upstash Redis.
7. Without a wallet, the judge can still use the landing-page graph and open the recorded explorer proofs. `/demo` says clearly that a wallet is needed and links to setup help.

### 5.3 Attribution & Reuse (`qday-io/aevum-starter-kit`, MIT)
* Reuse: `@aevum-kit/aevum` (`chain.ts`, `contracts.ts`, `eip3009.ts`, `logs.ts`, `anvil.ts`), `tools/check-shanghai.mjs`, `contracts/foundry.toml`, `contracts/test/Signing.sol`, `contracts/test/fork/AevumFork.t.sol`, and `web/src/app/api/relay/route.ts`.
* Keep `LICENSE` (MIT), maintain `NOTICE.md` listing dependencies (`forge-std`, `@openzeppelin/contracts` v5.1.0, `next`, `viem`, `wagmi`, `@rainbow-me/rainbowkit`, etc.), add source headers on adapted files, and credit `qday-io/aevum-starter-kit` (MIT, PQA Labs) in `README.md`.

### 5.4 Pending-Item Store (Tier 1)
Upstash Redis, also used for rate limits, holds items waiting for another person:
* **Contents:** half-signed invoices and voids, proposed rounds with the consents collected so far, and each member's current cash limit (signed by that member).
* **Flow:** the first signer creates the item and gets a link; the second signer opens it on any device, reviews the attested names and amounts, and signs. When every signature is present, the relayer submits.
* **Safety:** the store is untrusted. Each signature is checked before saving, and the contract checks everything again. Items expire at their signed `deadline`. Losing the store loses only unsubmitted items, never money.
* **Cash limits are planning inputs.** Binding limits are the mandate caps on-chain, or the exact amount the member signs for in manual mode.
* **Names:** business names and salts are served only to requests signed by an active member of that circle. A co-sign link shows names only after the invited member signs in with their wallet. An admin can delete a name, after which the app shows "unverified name". Server logs must not record names or salts.

### 5.5 Resilience & Async Confirmations
* **Clear states:** every submission is `waiting for signatures`, `submitting`, `pending`, `confirmed`, or `failed`, kept in the shared store by `roundHash` or request hash so a page refresh or closed tab resumes where it left off.
* **Safe resubmission:** before retrying, check the chain (`usedRoundHashes`, invoice `cleared`, `authorizationState`). If the action already happened, show success and do not send again. On-chain replay protection means a duplicate can waste gas but never move money twice.
* **Timeouts are not failures:** if a receipt is slow, keep the transaction hash, continue checking with backoff, and show "still confirming" with an explorer link.
* **RPC problems:** retry reads with backoff; never blindly retry a write. One submission lock per round stops two server instances sending it together.
* **Stale plans:** if an invoice, balance, mandate, or blacklist status changes before submission, simulation fails, the app explains why, and it re-solves and asks for new consent.
* **Relayer out of gas:** show a plain message and let a user with gas submit the same signed round themselves.

---

## 6. Multi-Phase Implementation Plan (UI First)

**Order rule:** all UI work (Phases 0 to 5) is finished before any contract, solver, relayer, or agent work (Phases 6 to 13). A phase starts only when the previous phase's exit gate is met.

**UI-first rules:**
* Screens read and write through one typed `SaldaClient` interface that mirrors Section 4. Phases 1 to 5 use `mockClient`; later phases swap in the live client without redesigning screens.
* Every mocked screen shows a visible **Sample data** label. Mock data never shows fake explorer links, transaction hashes, or "live" wording.
* Every screen is built with its loading, empty, error, pending, success, and wrong-network states, not only the happy path.
* Screens belonging to a feature that is later cut are removed, including any landing-page copy about them.

### Part A: UI

| Phase | Work | Exit gate |
|---|---|---|
| **0. Plan & setup** | Create the new public repository. Recheck DoraHacks rules and entries. Ask QDay Discord which ERC-8004 registry to use and whether more `tUSD8` is available. Claim test tokens. Read the UI structure sample. Produce the design brief, token plan, section list, and hero wireframe. Check download sizes before installing. | Design plan and hero wireframe approved. No code before this. |
| **1. UI foundation** | Fresh Next.js project, design tokens from Section 9.2, fonts, base components with all states (buttons, inputs, selection, badges, rows, tables, cards, dialogs, toasts), layouts, `SaldaClient` interface, and `mockClient`. | Type check and build pass. Components match `design.md` sizes, states, and contrast. No raw hex values in components. |
| **2. Landing page `/`** | Quiet hero, then the **live clearing graph in its own section** (the one loud idea), how it works, safety, who it is for, honest limits, closing call to action, footer. The graph uses the fixed example and a closed formula, needs no wallet, and has a text table version. | Page complete at every breakpoint. Graph shows `15 / 14 / 12` at cash `2 / 1 / 0` and correct values between. One loud idea only. |
| **3. App `/app`** | Dashboard home, circles and members, invoices (list, create, co-sign link, detail), clearing round builder (graph, slider, plan preview), consent review and signing, receipts, mandates (create, activate, revoke), agent activity, and settings. RainbowKit connection and wrong-network prompt. All on `mockClient`. | Every user journey in Section 3 can be clicked through with sample data, by mouse and keyboard, on desktop and mobile. |
| **4. Demo `/demo`** | Sandbox flow, demo counterparty labels, cash slider, signing steps, receipt, **Simulated compromised agent** rejection flow, revoke flow, no-wallet and wrong-network states. On `mockClient`. | Full judge path can be clicked through with sample data. |
| **5. UI quality gate** | Checks at 320, 390, 768, 1024, and 1440px. Accessibility, reduced motion, copy review, page speed, `design.md` review rubric and pre-ship checklist. Deploy to Vercel. | **UI GATE:** checklist passes and the public URL loads. After this, only wiring and bug fixes touch the UI. No further polish until Phase 11. |

### Part B: Contracts, Logic & Agent

| Phase | Work | Exit gate / cut line |
|---|---|---|
| **6. Tier 1 contract** | Start with the riskiest check: deploy a draft to Aevum and run a `10`-member, `30`-invoice `settle()`. Then `SaldaClearing.sol` (circles with membership checks, `registerInvoice(s)` with batch signing, `voidInvoice`, `payDirectWithAuthorization`, `settle` with partial amounts and net-zero consent, signed variants of circle actions), upgraded `MockUSD8.sol`, unit and fuzz tests, minimal fork tests, Shanghai check. | All Tier 1 tests pass, and the maximum-size round succeeds on Aevum or the limits are lowered and documented. |
| **7. Solver, relayer & store** | `BigInt` min-cost circulation solver (full netting, then cash limits), brute-force comparison tests, `/api/relay`, Upstash Redis rate limits and pending-item store, resilience rules from Section 5.5. | `15 / 14 / 12` tests pass. First end-to-end testnet round has an explorer link. |
| **8. Connect Tier 1** | Replace `mockClient` with the live client for circles, invoices, manual rounds, receipts, and `/demo`. Remove **Sample data** labels screen by screen. | **SUBMITTABLE:** a tester completes `/demo` on the public URL with a real wallet. Everything after this improves a working entry. |
| **9. Standing mandates** | `StandingMandate`, `activateMandate`, `AgentApproval` checks, gasless revoke, limit-tightening ratio solver, tests, then connect the mandate screens. Redeploy the contract and update every address. | **CUT LINE:** if mandate tests do not pass cleanly, remove mandate screens and ship manual consent. The rejection demo and proofs then use a missing consent and a replayed round. |
| **10. Clearing agent** | Scheduled and manual rounds, plain-language explanations, `AgentApproval` signing, live compromised-agent rejection, name-change warnings, ERC-8004 registration if confirmed, then connect the agent screens. | **CUT LINE:** if automatic execution is unstable, limit the agent to proposals and explanations, and keep the contract rejection demo. |
| **11. Hardening & freeze** | Section 7 verification, explorer proofs, outside testers, accessibility recheck, final UI fixes. Tier 3 only if everything above is complete. Then feature freeze. | Section 7 acceptance criteria met or the gap is documented. No new features after the freeze. |
| **12. Submission** | README against Section 7.4, 120-second demo video (0:00–0:25 problem, 0:25–1:15 live URL + explorer tx, 1:15–1:45 contract and mandate architecture, 1:45–2:00 vision), submit on DoraHacks. | Submitted early, with buffer before the deadline. |
| **13. Judging period** | Monitor Vercel, Upstash, and relayer `tQDAY`/`tUSD8` balances; daily `/demo` check; rehearse the live pitch in Section 7.5. | `/demo` stays working and funded. |

**Cut order if time runs short (first to go at the top):** Tier 3 → optional language-model wording → name-change warnings → ERC-8004 registration → automatic scheduling (keep the **Run clearing now** button) → agent execution (Phase 10 cut line) → standing mandates (Phase 9 cut line, last resort). The judging criteria name spending limits, scoped keys, revocation, and agent actions repeatedly, so mandates and the agent are protected the longest. Never cut Phases 6 to 8, the rejection demo, or the README. The Phase 9 rule still holds on safety grounds: never ship mandates whose tests fail. Before cutting them, first drop their optional parts (ERC-8004 check, cooldown) and retest.

---

## 7. Verification & Acceptance Criteria

### 7.1 Smart Contract Verification (`forge test` + Aevum Fork)
* **Core Invariants (Fuzzing):**
  * `totalPulled == totalPaid` on every `settle()`.
  * `tUSD8.balanceOf(address(SaldaClearing))` remains identically unchanged before and after every `settle()`.
  * `inv.cleared <= inv.amount` always; duplicate `invoiceIds` revert; voided invoices cannot be settled or paid directly.
  * Round replay across rounds or chains reverts; expired round deadline reverts; missing consent from **any** net debtor, net creditor, or **net-zero** touched participant reverts the entire batch atomically.
  * Registering an invoice with a non-member or deactivated member reverts; settling an existing invoice after deactivation still works with consent.
  * Every signed variant rejects a wrong signer, expired deadline, replay, wrong chain, and wrong contract address.
  * `tools/check-shanghai.mjs` reports `0` Cancun-only opcodes.
* **Mandate Invariant Tests:**
  * Activating a second mandate while one is active reverts, including for a different circle; it succeeds after revoke.
  * After a revoke, an older signed mandate that was never activated can't be activated, and the revoked one can't be reactivated.
  * Missing, invalid, or wrong-round `AgentApproval` reverts; a valid one succeeds when submitted by any address.
  * `payDirectWithAuthorization` leaves the mandate's ERC-20 allowance unchanged.
  * A member with no gas can revoke through the relayer, and the next round using that mandate reverts.
  * Per-round cap (`maxNetDebitPerRound + 1` reverts); cumulative `totalCap` across multiple rounds (`totalCap + 1` reverts).
  * `maxDueDays` boundary (`dueDate == now + N days` passes; `now + N days + 1` reverts).
  * `minClearRatioBps` boundary (`3.0x` passes; `2.999999x` reverts).
  * Wrong `agent`, expired `expiry`, single-mandate `revokeMandate`, and global `bumpMandateEpoch` all revert.
  * Mempool front-run of EIP-2612 `permit` prior to `activateMandate()` does **not** block activation.
* **Fork Tests (Minimal Set):**
  * `DOMAIN_SEPARATOR()` matches real `tUSD8` on Aevum (`44005`).
  * Real `tUSD8` EIP-3009 `receiveWithAuthorization` manual settlement + real `tUSD8` EIP-2612 `permit` mandate settlement pass against forked state.

### 7.2 Solver Verification (`npm test`)
* Exact `15 / 14 / 12` check case (`A->B 6, B->C 5, C->A 4` at `A_cash = 2, 1, 0`) passes with exact `BigInt` net transfers.
* Randomized property tests on small graphs (`N <= 5, E <= 8`) verify every output satisfies `0 <= x <= outstanding` and `out - in <= cash`. **Without ratios**, output must equal the brute-force optimum. **With ratios**, output must always be feasible; report how often it matches the optimum and the worst gap.
* Iteration guard test: with the cap forced low, the returned plan is still feasible and marked "not proven optimal". Record a benchmark at `N = 10, E = 30`.
* Ratio-constrained test (`A->B 10, B->A 2`, `A` mandate `3x`) outputs `[3, 2]` (total `5`, `A` pays `1`, ratio `3.0x`) rather than `[10, 2]`.

### 7.3 Live Testnet & UX Acceptance
* Four verifiable Aevum Testnet explorer proofs linked in `README.md`:
  1. Successful full-scale multilateral `settle()` round (`15 tUSD8` cleared with `2 tUSD8`).
  2. Rejected bad round (limit-violating, agent-signed proposal reverting against contract rules).
  3. Revoked mandate proof (revoke tx followed by rejected settlement attempt).
  4. Maximum-size round (`10` members, `30` invoices) succeeding on the real testnet. The chain runs a zk-rollup client with proving limits that local tests do not reproduce. If it fails, lower the contract's round limits.
* **How rejected transactions reach the explorer:** the relayer simulates first and never sends a failing round, and the in-app demo shows the simulated revert. Proofs 2 and 3 are sent once by a separate script with a fixed gas limit, outside the relayer, so the failed transaction has an explorer link.
* **First-Time Tester Test:** a tester with a wallet already installed finishes the live sandbox round, from connected wallet to explorer receipt, in **under 60 seconds**. Test on desktop with MetaMask and on a phone through WalletConnect.
* **No-wallet visitor:** the landing-page graph works fully without a wallet, and `/demo` explains what is needed.
* **Accessibility:** the full sandbox can be completed by keyboard alone, an automated accessibility check reports no serious issues, and the text table matches the graph.
* **Resilience:** refreshing during `pending` resumes correctly; submitting the same round twice moves money once; a delayed receipt shows "still confirming" rather than an error.
* **Privacy:** no business name, circle name, or salt appears in calldata, events, contract storage, or server logs; a non-member request for names is refused.
* **Agent identity (only if the registry is confirmed):** mismatched `agent` and `agentId` reverts activation; a failing registry does not affect `settle()`.

### 7.4 README & Documentation Checklist
* Problem, who it is for, and a one-paragraph explanation a non-crypto reader understands.
* Flowcharts: system architecture, invoice co-signing, manual round, mandate round, and rejected round.
* Environment variables: name, purpose, example value, required or optional, and whether it is secret.
* Aevum testnet addresses, constructor arguments, ABI, and exact source commit (explorer verification is unavailable).
* Step-by-step setup and reproduction, tested from a clean clone, plus how to run every test.
* API examples: request and response for the relayer, pending-item store, and agent endpoints, plus a TypeScript example that builds and signs a round.
* How each technology is used: `tUSD8` EIP-3009 and EIP-2612, Multicall3, scoped agent key, and ERC-8004 if enabled.
* Explorer proofs from Section 7.3.
* Known constraints: public amounts and addresses, unverifiable source on the explorer, untrusted but required relayer uptime for gasless users, trust in circle admins for names, heuristic ratio solver, all-or-nothing rounds, test tokens only.
* Roadmap, prior art, business hypotheses, licence, notices, and third-party dependencies.

### 7.5 Live Pitch (3 to 5 Minutes, Video Call)
Target 4 minutes, leaving room for questions and network delay.

| Time | Content |
|---|---|
| 0:00–0:30 | **Problem:** three shops, 15 owed, nobody can pay first. |
| 0:30–1:30 | **Live round:** open the sandbox, move the cash slider (`0.12` → `0.14` → `0.15`), sign, settle, open the explorer receipt. Explain that the sandbox is 1/100 scale and show the recorded `15 -> 2` proof. |
| 1:30–2:15 | **Agent:** show a mandate, run clearing without the member present, read the plain-language explanation. |
| 2:15–3:00 | **Safety:** simulated compromised agent is rejected, then revoke the mandate live and show the next round fail. |
| 3:00–3:30 | **How it works:** one diagram: signed invoices, untrusted solver, contract rechecks everything, no custody. |
| 3:30–4:00 | **Who pays and what is next:** pilot circles, operator subscription (hypothesis), path to mainnet. |

* **Backup plan:** a screen recording of the same flow and pre-opened explorer links, used only if the network fails, and say so openly. Check relayer and treasury balances just before the call.
* **Prepare answers for:** prior art, privacy of amounts, legal status of set-off, why the agent is needed, and what happens when a member is silent or blacklisted.
* If mandates were cut, replace the 1:30–3:00 section with manual consent, a missing-consent rejection, and a replayed-round rejection.

---

## 8. Key Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Scope creep past submission** | High | Tier 1 alone is a complete, submittable MVP; enforce hard Phase 9 (mandates) and Phase 10 (agent) cut lines, and the Phase 5 UI gate. |
| **Standing mandates touch ERC-20 allowances** | High | Small testnet caps, `totalCap` + `maxNetDebitPerRound` + `minClearRatioBps` + `maxDueDays` + `expiry` + instant revoke, non-upgradeable contract, front-run-safe `try permit`, exhaustive boundary fuzz tests. |
| **1,000-block `eth_getLogs` timeout at ~1s block speed** | Medium | Never scan history from `deployBlock` in browser; read current circle state via enumerable contract getters + `Multicall3`. |
| **Faucet `tUSD8` exhaustion during judging** | Medium | 1/100-scale sandbox costs at most `0.02 tUSD8` per session (about `300` sessions from `6 tUSD8`, with nothing recovered); server-held B and C balances can be returned to the treasury; per-wallet, per-IP, and global daily seed limits in Upstash Redis. |
| **Judge has no wallet or the wrong network** | Medium | The landing-page graph needs no wallet; `/demo` prompts to add Aevum, supports mobile through WalletConnect, and links to recorded proofs. |
| **UI-first order hides chain problems until later** | High | The UI uses one typed client interface taken from the contract design (Section 9). Phase 6 starts with the riskiest chain checks, including the maximum-size round. If a limit changes, only the interface data and copy change. |
| **Sample data mistaken for live data** | Medium | Every mocked screen shows a **Sample data** label until it is connected. Remove screens and copy for any feature that gets cut. |
| **`tUSD8` blacklist or pause** | Medium | One blacklisted member would revert a whole round. Check `paused()` and `isBlacklisted()` before solving, drop affected members, and re-solve. A pause or a blacklisted Salda contract stops all settlement; show this clearly in the UI. Invoices stay intact. |
| **Circle admin renames or misnames a member** | Medium | `MemberNameChanged` event, `nameUpdatedAt` warning before signing, and a plain statement that names are only as trustworthy as the admin. |
| **On-chain privacy & cold start** | Low/Medium | State plainly in README/UI that amounts, wallet addresses, and who owes whom are public; names and documents appear only as salted hashes; suggest a separate wallet address per circle; target closed trade circles that already trade repeatedly together. |

---

## 9. Tech Stack & Design System

### 9.1 Tech Stack

| Area | Choice |
|---|---|
| Web | Fresh Next.js (App Router), TypeScript, Tailwind v4, npm, in `web/` |
| Wallets | RainbowKit, wagmi, viem. No guest accounts. Needs a free WalletConnect project ID (`NEXT_PUBLIC_WC_PROJECT_ID`). Pin versions that work together and theme RainbowKit with the design tokens |
| Data store | Upstash Redis (pending items, rate limits, private names) |
| Contracts | Solidity `0.8.24`, Foundry, Shanghai EVM, in `contracts/` |
| Solver | Pure TypeScript with `BigInt`, in `packages/solver/`, shared by browser and server |
| Starter kit | Not forked. Copy only the needed chain helpers, relayer, and contract test helpers, with credit (Section 5.3) |
| Hosting | Vercel. Check cron limits before relying on scheduling |
| AI model | None required. Optional rewording only (Section 4.2) |

**Data budget:** limited bandwidth and 8 GB RAM. Check package sizes before installing, add wallet packages only in Phase 3, and avoid packages that duplicate something already installed.

### 9.2 Design System
* **Source of truth:** the **Core** system of the supplied `design.md` (71UI), light theme. The file itself is not committed to the public repository unless its license allows it.
* **Structure:** comes from the UI structure sample the builder will supply. Use its layout only, adjust it where needed, and ignore its colors and typography.
* **Color roles:** `canvas #FFFFFF`, `surface #FAFAFA`, `surface-2 #F4F4F5`, `hairline #EBEBEB`, `hairline-strong #D4D4D8`, `ink-strong #111111`, `ink #333333`, `ink-subtle #6B6B6B`, `primary #0070E0`, `primary-hover #005FC2`, `on-primary #FFFFFF`, `inverse #111111`, `control-border #8A8A8A`, plus the Core status colors. Components use role tokens only.
* **Accent:** blue appears only on the primary action, focus rings, key data, and the brand mark. Neutrals do about 90% of the work.
* **Type:** Inter for interface and display, Geist Mono for addresses and IDs. Weights 400 to 500, tracking tightens as size grows, tabular numerals on every amount.
* **Space and shape:** 4px scale; 96 to 128px between marketing sections; 10px controls, 12 to 16px cards, 24px marketing tiles; inner radius equals outer radius minus padding.
* **Depth:** tone, then hairline, then ring, then shadow. One method per surface.
* **Motion:** under 300ms for interface actions, ease-out curves, reduced motion respected.
* **Loud idea:** exactly one per page. On the landing page it is the live clearing graph, in its own section. The hero stays quiet with one primary action.
* **App home:** `/app` opens on a small dashboard (debt owed, debt owed to you, clearable now, next round), with the rest of the app in the sidebar.

### 9.3 Landing Graph Formula (Fixed Example)
For `A->B 6`, `B->C 5`, `C->A 4`, where only A has cash `c` from `0` to `2`:
* `0 <= c <= 1`: clears `[4 + c, 4 + c, 4]`, total `12 + 2c`
* `1 <= c <= 2`: clears `[4 + c, 5, 4]`, total `13 + c`

Phase 7 adds a test that the real solver gives the same results.
