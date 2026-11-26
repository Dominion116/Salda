"use client";

import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import type { Address } from "@/client/types";
import {
  aevum,
  CONSENT_SIGNED,
  hashRound,
  SALDA,
  saldaDomain,
  saldaTypes,
  settleNonce,
  tusd8Domain,
  tusd8Types,
  type InvoiceInput,
  type RoundInput,
} from "@/chain/salda";
import { demoRound } from "@/lib/demo";
import { explain } from "@/lib/explain";
import { callApi } from "@/lib/wire";
import type { RoundRecord } from "@/server/rounds";

/*
 * The live judge demo (PRD 5.2): two wallet prompts in total. The server plays Ben and Chidi, pays every fee
 * and seeds 0.02 tUSD8 after the first signature.
 */

type Started = { circleId: bigint; invoices: InvoiceInput[]; deadline: bigint; ben: Address; chidi: Address; createTx: Hex };
type Registered = { registerTx?: Hex; seedTx?: Hex; invoiceIds: bigint[]; seeded: boolean };
export type AttackResult = { refused: boolean; revert: string | null; message: string; moved: string };

export type LiveDemo = {
  /** True when the server can run the live demo and the wallet is on Aevum. */
  ready: boolean;
  attacksReady: boolean;
  /** Setup steps finished so far (-1 for none), and the error that stopped them. */
  startDone: number;
  settleDone: number;
  error: string | null;
  txs: { create?: Hex; register?: Hex; seed?: Hex; settle?: Hex };
  seeded: boolean;
  settled: RoundRecord | null;
  start: () => Promise<boolean>;
  settle: (cash: bigint) => Promise<boolean>;
  attack: (attack: string, revoked: boolean) => Promise<AttackResult | null>;
  reset: () => void;
};

export function useLiveDemo(): LiveDemo {
  const { address, chainId } = useAccount();
  const { data: wallet } = useWalletClient();
  const [available, setAvailable] = useState({ live: false, attacks: false });
  const [session, setSession] = useState<Started | null>(null);
  const [ids, setIds] = useState<bigint[]>([]);
  const [startDone, setStartDone] = useState(-1);
  const [settleDone, setSettleDone] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [txs, setTxs] = useState<LiveDemo["txs"]>({});
  const [seeded, setSeeded] = useState(false);
  const [settled, setSettled] = useState<RoundRecord | null>(null);

  useEffect(() => {
    callApi<{ live: boolean; attacks: boolean }>("/api/demo")
      .then(setAvailable)
      .catch(() => setAvailable({ live: false, attacks: false }));
  }, []);

  const ready = Boolean(SALDA && available.live && address && wallet && chainId === aevum.id);

  const reset = useCallback(() => {
    setSession(null);
    setIds([]);
    setStartDone(-1);
    setSettleDone(-1);
    setError(null);
    setTxs({});
    setSeeded(false);
    setSettled(null);
  }, []);

  const start = async () => {
    if (!ready || !address || !wallet || !SALDA) return false;
    setError(null);
    try {
      const started = await callApi<Started>("/api/demo", { action: "start", player: address });
      setSession(started);
      setTxs((current) => ({ ...current, create: started.createTx }));
      setStartDone(0);
      const signature = await wallet.signTypedData({
        account: address,
        domain: saldaDomain(SALDA),
        types: saldaTypes.RegisterInvoiceBatch,
        primaryType: "RegisterInvoiceBatch",
        message: { invoices: started.invoices, deadline: started.deadline },
      });
      const registered = await callApi<Registered>("/api/demo", { action: "register", circleId: started.circleId, signature });
      setIds(registered.invoiceIds);
      setSeeded(registered.seeded);
      setTxs((current) => ({ ...current, register: registered.registerTx, seed: registered.seedTx }));
      setStartDone(2);
      return true;
    } catch (failure) {
      setError(explain(failure));
      return false;
    }
  };

  const settle = async (cash: bigint) => {
    if (!ready || !address || !wallet || !SALDA || !session || ids.length !== 3) return false;
    setError(null);
    try {
      const plan = demoRound(cash);
      // Invoices were registered in order: you -> Ben, Ben -> Chidi, Chidi -> you.
      const round: RoundInput = {
        circleId: session.circleId,
        roundNonce: BigInt(Date.now()),
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3_600),
        invoiceIds: ids,
        clearAmounts: plan.debts.map((debt) => debt.cleared),
      };
      const roundHash = hashRound(SALDA, round);
      const out = plan.debts[0]!.cleared;
      const inflow = plan.debts[2]!.cleared;
      const signature =
        out > inflow
          ? await wallet.signTypedData({
              account: address,
              domain: tusd8Domain,
              types: tusd8Types.ReceiveWithAuthorization,
              primaryType: "ReceiveWithAuthorization",
              message: {
                from: address,
                to: SALDA,
                value: out - inflow,
                validAfter: 0n,
                validBefore: round.deadline,
                nonce: settleNonce(SALDA, roundHash, address),
              },
            })
          : await wallet.signTypedData({
              account: address,
              domain: saldaDomain(SALDA),
              types: saldaTypes.ApproveRound,
              primaryType: "ApproveRound",
              message: { roundHash, member: address, outTotal: out, inTotal: inflow },
            });
      setSettleDone(1);
      const consent = { member: address, kind: CONSENT_SIGNED, validAfter: 0n, validBefore: round.deadline, signature };
      const record = await callApi<RoundRecord>("/api/demo", { action: "settle", circleId: session.circleId, round, consent });
      setSettled(record);
      setTxs((current) => ({ ...current, settle: record.txHash }));
      setSettleDone(record.state === "confirmed" ? 3 : 2);
      return record.state === "confirmed" || record.state === "pending";
    } catch (failure) {
      setError(explain(failure));
      return false;
    }
  };

  const attack = async (key: string, revoked: boolean) => {
    setError(null);
    try {
      return await callApi<AttackResult>("/api/demo", { action: "attack", attack: key, revoked });
    } catch (failure) {
      setError(explain(failure));
      return null;
    }
  };

  return {
    ready,
    attacksReady: available.attacks,
    startDone,
    settleDone,
    error,
    txs,
    seeded,
    settled,
    start,
    settle,
    attack,
    reset,
  };
}
