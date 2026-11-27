import { runAiAgent } from "@/server/ai-agent";
import { agentInfo, listEvents, runAgent, type AgentEvent } from "@/server/agent";
import { body, clientIp, handle, limit, refuse, reply, units } from "@/server/http";
import { AI_MODEL, aiEnabled, ModelUnavailable } from "@/server/llm";

/*
 * The clearing agent's endpoint. GET ?info=1 names the agent key and model; GET ?circleId= lists its activity;
 * POST runs it now ("Run clearing now"). The scheduled run comes from Vercel Cron (web/vercel.json), which calls
 * GET ?cron=1 with "Authorization: Bearer $CRON_SECRET" for each circle in AGENT_CIRCLES.
 *
 * With GROQ_API_KEY set, the AI agent plans the round; if the model is unavailable or over its daily limit, the
 * rules-based agent runs instead, and the summary says so.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

async function clear(circleId: bigint, useAi: boolean): Promise<AgentEvent> {
  if (useAi && aiEnabled()) {
    try {
      return (await runAiAgent(circleId)).event;
    } catch (error) {
      if (!(error instanceof ModelUnavailable)) throw error;
      const fallback = await runAgent(circleId);
      return { ...fallback, summary: `${error.message} The rules-based agent ran instead. ${fallback.summary}` };
    }
  }
  return runAgent(circleId);
}

export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    if (params.get("info")) return reply({ ...agentInfo(), model: aiEnabled() ? AI_MODEL : null });

    if (params.get("cron")) {
      const secret = process.env.CRON_SECRET?.trim();
      if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return refuse("Not allowed.", 401);
      const circles = (process.env.AGENT_CIRCLES ?? "").split(",").map((item) => item.trim()).filter((item) => /^\d+$/.test(item));
      const events = [];
      for (const id of circles) events.push(await clear(BigInt(id), true).catch((error: Error) => ({ circleId: id, error: error.message })));
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
    const { circleId, ai } = await body<{ circleId?: unknown; ai?: unknown }>(request);
    return reply(await clear(units(circleId, "circle"), ai !== false));
  });
}
