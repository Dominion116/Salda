import type { ConsentInput, RoundInput } from "@/chain/salda";
import { demoBenAccount, demoChidiAccount, relayerAccount } from "@/server/chain";
import { registerDemo, settleDemo, simulateAttack, startDemo, type AttackKey } from "@/server/demo";
import { address, body, clientIp, handle, hex, limit, refuse, reply, units } from "@/server/http";
import { SALDA } from "@/chain/salda";

/*
 * The judge sandbox. GET says whether the live demo is available. POST runs one step:
 * start -> register -> settle, or attack (the simulated compromised agent).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ATTACKS: AttackKey[] = ["fair", "ratio", "cap", "due"];

export async function GET() {
  const ben = demoBenAccount();
  const chidi = demoChidiAccount();
  return reply({
    live: Boolean(SALDA && relayerAccount() && ben && chidi),
    attacks: Boolean(process.env.DEMO_ATTACK_CIRCLE),
    ben: ben?.address ?? null,
    chidi: chidi?.address ?? null,
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request);
    await limit(`demo:ip:${ip}`, 20);
    const input = await body<Record<string, unknown>>(request);
    switch (input.action) {
      case "start":
        return reply(await startDemo(address(input.player, "wallet"), ip));
      case "register":
        return reply(await registerDemo(units(input.circleId, "circle"), hex(input.signature, "signature"), ip));
      case "settle":
        return reply(await settleDemo(units(input.circleId, "circle"), input.round as RoundInput, input.consent as ConsentInput));
      case "attack": {
        const attack = input.attack as AttackKey;
        if (!ATTACKS.includes(attack)) return refuse("Choose one of the attacks.");
        return reply(await simulateAttack(attack, input.revoked === true));
      }
      default:
        return refuse("Unknown request.");
    }
  });
}
