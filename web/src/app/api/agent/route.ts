import { agentInfo, listEvents, runAgent } from "@/server/agent";
import { body, clientIp, handle, limit, refuse, reply, units } from "@/server/http";

/*
 * The clearing agent's endpoint. GET ?info=1 names the agent key; GET ?circleId= lists its activity; POST runs it
 * now ("Run clearing now"). The scheduled run comes from Vercel Cron (web/vercel.json), which calls
 * GET ?cron=1 with "Authorization: Bearer $CRON_SECRET" for each circle in AGENT_CIRCLES.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    if (params.get("info")) return reply(agentInfo());

    if (params.get("cron")) {
      const secret = process.env.CRON_SECRET?.trim();
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return refuse("Not allowed.", 401);
      const circles = (process.env.AGENT_CIRCLES ?? "").split(",").map((item) => item.trim()).filter((item) => /^\d+$/.test(item));
      const events = [];
      for (const id of circles) events.push(await runAgent(BigInt(id)).catch((error: Error) => ({ circleId: id, error: error.message })));
      return reply({ ran: events.length, events });
    }

    await limit(`agent:read:${clientIp(request)}`, 60);
    const circleId = BigInt(params.get("circleId") ?? "0");
    if (circleId <= 0n) return refuse("Choose a circle.");
    return reply(await listEvents(circleId));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await limit(`agent:run:${clientIp(request)}`, 5);
    const { circleId } = await body<{ circleId?: unknown }>(request);
    return reply(await runAgent(units(circleId, "circle")));
  });
}
