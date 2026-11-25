"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { shortAddress } from "@/lib/format";
import { aevum } from "./config";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        // Keep the space until the wallet state is known, so the bar does not jump.
        if (!mounted) return <span aria-hidden="true" className="skeleton h-8 w-32 rounded-control" />;
        if (!account || !chain) return <Button variant="inverse" onClick={openConnectModal}>Connect wallet</Button>;
        return (
          <Button onClick={openAccountModal} aria-label={`Wallet ${account.address}. Open wallet details`}>
            <span className="font-mono text-mono">{shortAddress(account.address)}</span>
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}

/** Asks for Aevum when the connected wallet is on another network. Adds it if it is missing. */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const show = useToast();

  if (!isConnected || chainId === aevum.id) return null;

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-hairline bg-warning-fill px-4 py-3 text-body-sm text-on-warning sm:px-6">
      <AlertIcon className="shrink-0" />
      <p className="min-w-0 flex-1">Your wallet is on another network. Salda signs on {aevum.name} only.</p>
      <Button
        icon={<AlertIcon />}
        loading={isPending}
        onClick={() =>
          switchChain(
            { chainId: aevum.id },
            {
              onError: () =>
                show({
                  tone: "error",
                  message: `Unable to switch. In your wallet, choose ${aevum.name}, network ID ${aevum.id}.`,
                }),
            },
          )
        }
      >
        Switch to Aevum
      </Button>
    </div>
  );
}
