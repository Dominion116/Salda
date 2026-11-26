import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/*
 * One sentence a non-crypto user can act on, for every wallet, RPC and contract error. Adapted from
 * qday-io/aevum-starter-kit (MIT, PQA Labs), with SaldaClearing's errors added.
 */

const contractErrors: Record<string, string> = {
  Expired: "The time to sign ran out before it was submitted. Nothing moved. Sign again.",
  InvalidSignature: "A signature does not match what was submitted. Nothing moved. Sign again.",
  MissingSignature: "Both businesses on every invoice must sign. Ask the other business to sign.",
  NotActiveMember: "Both businesses must be active members of this circle.",
  NotCircleAdmin: "Only the person who runs this circle can change its members.",
  CircleNotFound: "That circle was not found.",
  InvalidInvoice: "Check the invoice: the amount must be above 0 and the two businesses must differ.",
  InvoiceAlreadyRegistered: "This invoice is already recorded.",
  InvoiceNotFound: "That invoice was not found.",
  InvoiceVoidedAlready: "This invoice was voided, so it can no longer be cleared or paid.",
  NothingLeftToClear: "This invoice is already fully cleared.",
  OverClear: "An invoice changed after this round was planned. Plan a new round.",
  WrongCircle: "An invoice in this round belongs to another circle.",
  InvoiceIdsNotAscending: "This round lists an invoice twice. Plan a new round.",
  ZeroClearAmount: "This round has an empty line. Plan a new round.",
  TooManyMembers: "A round can include at most 10 businesses.",
  BadRoundSize: "A round can include 1 to 30 invoices.",
  BadBatchSize: "You can add 1 to 30 invoices at a time.",
  RoundAlreadySettled: "This round has already settled.",
  ConsentCountMismatch: "Every business in the round must agree before it settles.",
  MissingConsent: "A business in this round has not agreed yet.",
  CashNotConserved: "The round did not balance, so nothing moved.",
  StaleMandate: "This mandate was signed before your last revoke. Sign a new one.",
  MandateAlreadyUsed: "This mandate was already used once. Sign a new one.",
  MandateAlreadyActive: "Revoke your current mandate before you start a new one.",
  MandateNotFound: "That mandate was not found.",
  NotMandateOwner: "Only the business that signed a mandate can revoke it.",
  AgentNotRegistered: "That agent key does not own the agent ID in the registry.",
  InsufficientAllowance: "The spending approval is lower than the total limit. Sign the approval again.",
  NoActiveMandate: "A business in this round has no active mandate.",
  MandateRevoked: "The mandate was revoked, so the contract refused the round. Nothing moved.",
  MandateExpired: "The mandate has expired, so the contract refused the round. Nothing moved.",
  MandateWrongCircle: "The mandate is for another circle, so the contract refused the round.",
  MissingAgentApproval: "The agent did not approve this round, so the contract refused it.",
  CooldownActive: "The mandate was used too recently. Try again later.",
  InvoiceDueTooFar: "An invoice is due later than the mandate allows, so the contract refused the round.",
  ExceedsRoundCap: "It would pay more than the mandate's limit for one round, so the contract refused it.",
  ExceedsTotalCap: "It would pay more than the mandate's total limit, so the contract refused it.",
  ClearRatioTooLow: "It would clear too little debt for the cash paid, so the contract refused it.",
  Blacklisted: "A business in this round cannot receive or send tUSD8 right now, so nothing moved.",
  Paused: "tUSD8 transfers are paused right now. Try again later.",
};

/** The contract error name inside an error, if there is one. */
export function revertName(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const revert = error.walk((item) => item instanceof ContractFunctionRevertedError);
  return revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
}

export function explain(error: unknown): string {
  if (!(error instanceof Error)) return "Something did not finish. Try again.";
  const duplicate = /same RPC endpoint as existing network for chain \w+ \('([^']*)'\)/.exec(fullMessage(error));
  if (duplicate) {
    return `Your wallet already has a network ("${duplicate[1]}") using the same address. Edit or remove it in your wallet, then try again.`;
  }
  if (error instanceof BaseError) {
    if (error.walk((item) => item instanceof UserRejectedRequestError)) {
      return "You cancelled the request in your wallet. Nothing was sent.";
    }
    const name = revertName(error);
    if (name && contractErrors[name]) return contractErrors[name];
    const revert = error.walk((item) => item instanceof ContractFunctionRevertedError);
    const reason = revert instanceof ContractFunctionRevertedError ? (revert.reason ?? "") : "";
    if (/blacklist/i.test(reason)) return contractErrors.Blacklisted!;
    if (/paused/i.test(reason)) return contractErrors.Paused!;
    if (/exceeds balance|insufficient/i.test(reason)) return "Not enough tUSD8 in a wallet for this round.";
    if (/authorization is (expired|not yet valid)/i.test(reason)) return contractErrors.Expired!;
    if (/invalid signature/i.test(reason)) return contractErrors.InvalidSignature!;
    if (/insufficient funds/i.test(error.message)) return "Not enough tQDAY for gas. Get some from the faucet.";
    return error.shortMessage;
  }
  return error.message;
}

/** Wallet errors often hide the real reason in `cause` or `data.cause`. */
function fullMessage(error: unknown, depth = 0): string {
  if (!error || typeof error !== "object" || depth > 5) return "";
  const e = error as { message?: unknown; details?: unknown; cause?: unknown; data?: { cause?: unknown; message?: unknown } };
  return [e.message, e.details, e.data?.message, fullMessage(e.cause, depth + 1), fullMessage(e.data?.cause, depth + 1)]
    .filter((item) => typeof item === "string" && item)
    .join(" | ");
}
