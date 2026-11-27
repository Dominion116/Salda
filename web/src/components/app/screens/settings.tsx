"use client";

import { useAccount, useDisconnect } from "wagmi";
import { AddressText, KeyValues, PageHeader } from "@/components/app/parts";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/data";
import { SALDA } from "@/chain/salda";
import { aevum, EXPLORER, hasMobileWallets, TUSD8 } from "@/wallet/config";

export function SettingsScreen() {
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-measure flex-col gap-6">
        <Panel heading="h2" title="Wallet" description="Your wallet signs for your business. Salda pays the network fees.">
          <div className="flex flex-col items-start gap-4">
            <div className="w-full">
              <KeyValues
                rows={[
                  ["Connected as", address ? <AddressText key="address" address={address} /> : "Not connected"],
                  ["Network", chainId === aevum.id ? aevum.name : "Another network"],
                  ["Phone wallets", hasMobileWallets ? "Available" : "Not set up yet"],
                ]}
              />
            </div>
            <Button onClick={() => disconnect()}>Disconnect wallet</Button>
          </div>
        </Panel>

        <Panel heading="h2" title="Network">
          <div className="flex flex-col items-start gap-4">
            <div className="w-full">
              <KeyValues
                rows={[
                  ["Name", aevum.name],
                  ["Network ID", `${aevum.id}`],
                  ["Token", "tUSD8, a test token"],
                  ["Token address", <AddressText key="token" address={TUSD8} />],
                  ...(SALDA ? [["Salda contract", <AddressText key="salda" address={SALDA} />] as [string, React.ReactNode]] : []),
                ]}
              />
            </div>
            <a href={EXPLORER} rel="noopener" className="hit-44 text-body-sm text-link underline underline-offset-4 hover:text-primary-hover">
              Open the Aevum explorer
            </a>
          </div>
        </Panel>
      </div>
    </>
  );
}
