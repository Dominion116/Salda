"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { aevum, SALDA } from "@/chain/salda";
import { useToast } from "@/components/ui/toast";
import { createLiveClient } from "./live";
import { SaldaError, type Address, type Circle, type RoundPlan, type SaldaClient, type Units } from "./types";

type Session = {
  client: SaldaClient;
  /** 0 when this business is not in any circle yet. */
  circleId: bigint;
  setCircleId: (id: bigint) => void;
  /** The connected wallet. */
  me: Address;
};

const SessionContext = createContext<Session | null>(null);

/** Why the app cannot show live data yet. The app frame shows the matching screen. */
export type GateReason = "not-deployed" | "connect" | "wrong-network" | "loading";

/**
 * The app runs on live data only: SaldaClearing on Aevum, through the connected wallet. Until a wallet is connected
 * on Aevum and its circles have loaded, it renders `gate` instead of the app. Sample data lives only in /demo.
 */
export function SaldaProvider({ children, gate }: { children: ReactNode; gate: (reason: GateReason) => ReactNode }) {
  const queries = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const { data: wallet } = useWalletClient();
  const [circleId, setCircleId] = useState<bigint | null>(null);

  const client = useMemo(
    () =>
      SALDA && isConnected && address && wallet && chainId === aevum.id
        ? createLiveClient({ contract: SALDA, wallet, me: address })
        : null,
    [isConnected, address, wallet, chainId],
  );

  // A new wallet or network starts fresh, on the first circle this business belongs to.
  useEffect(() => {
    queries.removeQueries({ queryKey: ["salda"] });
    setCircleId(null);
    if (!client) return;
    let cancelled = false;
    client
      .listCircles()
      .then((circles) => {
        if (!cancelled) setCircleId(circles[0]?.id ?? 0n);
      })
      .catch(() => {
        if (!cancelled) setCircleId(0n);
      });
    return () => {
      cancelled = true;
    };
  }, [client, queries]);

  const session = useMemo(
    () => (client && address && circleId !== null ? { client, circleId, setCircleId, me: address } : null),
    [client, address, circleId],
  );

  if (!SALDA) return gate("not-deployed");
  if (!isConnected) return gate("connect");
  if (chainId !== aevum.id) return gate("wrong-network");
  if (!session) return gate("loading");
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSalda(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSalda must be used inside SaldaProvider");
  return session;
}

/** Every key starts with "salda" so one change refreshes every screen. Keys hold strings, never bigint. */
function useRead<T>(key: string[], read: (client: SaldaClient) => Promise<T>): UseQueryResult<T> {
  const { client } = useSalda();
  return useQuery({ queryKey: ["salda", ...key], queryFn: () => read(client) });
}

export const useCircles = () => useRead(["circles"], (client) => client.listCircles());
export function useCircle() {
  const { circleId } = useSalda();
  return useRead(["circle", `${circleId}`], (client) => client.getCircle(circleId));
}
export function useInvoices() {
  const { circleId } = useSalda();
  return useRead(["invoices", `${circleId}`], (client) => client.listInvoices(circleId));
}
export function usePendingInvoices() {
  const { circleId } = useSalda();
  return useRead(["pending", `${circleId}`], (client) => client.listPendingInvoices(circleId));
}
export function useRounds() {
  const { circleId } = useSalda();
  return useRead(["rounds", `${circleId}`], (client) => client.listRounds(circleId));
}
/** Checks again every few seconds while a round is being sent or confirmed, so the page updates by itself. */
export function useRound(key: string) {
  const { client } = useSalda();
  return useQuery({
    queryKey: ["salda", "round", key],
    queryFn: () => client.getRound(key),
    refetchInterval: (query) => (query.state.data?.state === "pending" || query.state.data?.state === "submitting" ? 4_000 : false),
  });
}
export function useCashLimits() {
  const { circleId } = useSalda();
  return useRead(["cash", `${circleId}`], (client) => client.listCashLimits(circleId));
}
export const useMandate = (member: Address) => useRead(["mandate", member], (client) => client.getMandate(member));
export function useMandates(members: readonly Address[]) {
  return useRead(["mandates", ...members], (client) => Promise.all(members.map((member) => client.getMandate(member))));
}
export function useAgentEvents() {
  const { circleId } = useSalda();
  return useRead(["events", `${circleId}`], (client) => client.listAgentEvents(circleId));
}

export function usePlan(limits: ReadonlyMap<Address, Units>): UseQueryResult<RoundPlan> {
  const { client, circleId } = useSalda();
  const parts = [...limits].map(([member, amount]) => `${member}:${amount}`);
  return useQuery({
    queryKey: ["salda", "plan", `${circleId}`, ...parts],
    queryFn: () => client.planRound(circleId, limits),
    placeholderData: keepPreviousData,
  });
}

export function messageOf(error: unknown): string {
  return error instanceof SaldaError ? error.message : "Something did not finish. Check your connection, then try again.";
}

/** Runs a change, refreshes every screen, and reports the result. Resolves to undefined on failure. */
export function useChange<Args extends unknown[], Result>(
  change: (client: SaldaClient, ...args: Args) => Promise<Result>,
  success?: string | ((result: Result) => string | undefined),
) {
  const { client } = useSalda();
  const queries = useQueryClient();
  const show = useToast();
  const mutation = useMutation({ mutationFn: (args: Args) => change(client, ...args) });

  const run = async (...args: Args): Promise<Result | undefined> => {
    try {
      const result = await mutation.mutateAsync(args);
      await queries.invalidateQueries({ queryKey: ["salda"] });
      const message = typeof success === "function" ? success(result) : success;
      if (message) show({ tone: "success", message });
      return result;
    } catch (error) {
      show({ tone: "error", message: messageOf(error) });
      return undefined;
    }
  };
  return { run, busy: mutation.isPending };
}

export type NameOf = (address: Address) => string;

/** Names come only from the circle admin’s attestations. Anything else reads as unverified. */
export function nameIn(circle: Circle | undefined): NameOf {
  return (address) => {
    const name = circle?.members.find((member) => member.address === address)?.name;
    return name?.status === "verified" ? name.value : "Unverified name";
  };
}
