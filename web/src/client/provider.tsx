"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { createMockClient, SAMPLE_CIRCLE, sampleMembers } from "./mock";
import { SaldaError, type Address, type Circle, type RoundPlan, type SaldaClient, type Units } from "./types";

type Session = {
  client: SaldaClient;
  circleId: bigint;
  setCircleId: (id: bigint) => void;
  /** The business whose view this is. With sample data you choose; live, it is the wallet. */
  me: Address;
  setMe: (member: Address) => void;
  resetSample: () => void;
};

const SessionContext = createContext<Session | null>(null);
const newSample = () => createMockClient({ latencyMs: 250 });

export function SaldaProvider({ children }: { children: ReactNode }) {
  const queries = useQueryClient();
  const [client, setClient] = useState(newSample);
  const [circleId, setCircleId] = useState(SAMPLE_CIRCLE);
  const [me, setMe] = useState<Address>(sampleMembers.ada);

  const resetSample = useCallback(() => {
    setClient(newSample);
    setCircleId(SAMPLE_CIRCLE);
    setMe(sampleMembers.ada);
    queries.removeQueries({ queryKey: ["salda"] });
  }, [queries]);

  const session = useMemo(
    () => ({ client, circleId, setCircleId, me, setMe, resetSample }),
    [client, circleId, me, resetSample],
  );
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
export const useRound = (key: string) => useRead(["round", key], (client) => client.getRound(key));
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
