"use client";

import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useSalda } from "@/client/provider";
import { AddressText, KeyValues, PageHeader } from "@/components/app/parts";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/data";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { aevum, EXPLORER, hasMobileWallets, TUSD8 } from "@/wallet/config";
import { WalletButton } from "@/wallet/wallet-button";

export function SettingsScreen() {
  const { client, resetSample } = useSalda();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const show = useToast();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-measure flex-col gap-6">
        <Panel
          heading="h2"
          title="Wallet"
          description={
            client.mode === "sample"
              ? "Connecting is optional for now. Sample data never asks your wallet to sign."
              : "Your wallet signs for your business."
          }
        >
          <div className="flex flex-col items-start gap-4">
            <div className="w-full">
              <KeyValues
                rows={[
                  ["Connected as", isConnected && address ? <AddressText key="address" address={address} /> : "Not connected"],
                  ["Network", !isConnected ? "Not connected" : chainId === aevum.id ? aevum.name : "Another network"],
                  ["Phone wallets", hasMobileWallets ? "Available" : "Not set up yet"],
                ]}
              />
            </div>
            {isConnected ? <Button onClick={() => disconnect()}>Disconnect wallet</Button> : <WalletButton />}
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
                ]}
              />
            </div>
            <a href={EXPLORER} rel="noopener" className="hit-44 text-body-sm text-link underline underline-offset-4 hover:text-primary-hover">
              Open the Aevum explorer
            </a>
          </div>
        </Panel>

        {client.mode === "sample" ? (
          <Panel
            heading="h2"
            title="Sample data"
            description="Everything in the app is sample data kept in this tab. Reloading the page resets it too."
          >
            <ConfirmDialog
              trigger="Reset sample data"
              triggerVariant="danger"
              title="Reset sample data?"
              description="Removes every invoice, round, mandate and circle you added in this tab, and starts again with three invoices."
              confirm="Reset sample data"
              confirmVariant="danger"
              onConfirm={() => {
                resetSample();
                show({ tone: "success", message: "Sample data reset" });
                router.push("/app");
              }}
            />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
