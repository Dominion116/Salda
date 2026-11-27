/*
 * The language model behind the AI clearing agent: Groq's OpenAI-compatible Chat Completions API, called with
 * fetch (no extra package). The model only chooses which tools to call; every tool is ours, runs on this server,
 * and the contract rechecks anything that could move money. Nothing here ever sees a private key.
 *
 *   GROQ_API_KEY   required to turn the AI agent on
 *   GROQ_MODEL     optional, default openai/gpt-oss-120b
 */

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const AI_MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
export const aiEnabled = () => Boolean(process.env.GROQ_API_KEY?.trim());

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type Tool = {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export type Step = { tool: string; input: string; output: string };

/** The model could not be reached, was rate limited, or misbehaved. Callers fall back to the rules-based agent. */
export class ModelUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelUnavailable";
  }
}

/**
 * Runs a tool-calling loop until the model answers in plain text or `maxTurns` is reached. Tool errors go back to
 * the model as results, so it can correct itself; they never throw out of the loop.
 */
export async function runWithTools({
  system,
  user,
  tools,
  maxTurns = 6,
  deadlineMs = 45_000,
}: {
  system: string;
  user: string;
  tools: Tool[];
  maxTurns?: number;
  deadlineMs?: number;
}): Promise<{ answer: string; steps: Step[] }> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new ModelUnavailable("The AI agent is not set up.");
  const started = Date.now();
  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const steps: Step[] = [];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  for (let turn = 0; turn < maxTurns; turn++) {
    const left = deadlineMs - (Date.now() - started);
    if (left < 3_000) break;
    const reply = await complete(key, messages, tools, left);
    const message = reply.message;
    if (!message.tool_calls?.length) return { answer: (message.content ?? "").trim(), steps };

    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      const tool = byName.get(call.function.name);
      let output: unknown;
      if (!tool) {
        output = { error: `There is no tool called ${call.function.name}.` };
      } else {
        try {
          const args = call.function.arguments ? (JSON.parse(call.function.arguments) as unknown) : {};
          if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object.");
          output = await tool.run(args as Record<string, unknown>);
        } catch (error) {
          output = { error: error instanceof Error ? error.message : "The tool failed." };
        }
      }
      const text = JSON.stringify(output);
      steps.push({ tool: call.function.name, input: call.function.arguments || "{}", output: text });
      messages.push({ role: "tool", tool_call_id: call.id, content: text });
    }
  }
  return { answer: "", steps };
}

async function complete(key: string, messages: Message[], tools: Tool[], timeoutMs: number) {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        tools: tools.map((tool) => ({
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
        tool_choice: "auto",
        temperature: 0.2,
        max_completion_tokens: 1_200,
      }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, 30_000)),
      cache: "no-store",
    });
  } catch {
    throw new ModelUnavailable("The AI model did not answer in time.");
  }
  if (response.status === 429) throw new ModelUnavailable("The AI model is busy right now.");
  if (!response.ok) throw new ModelUnavailable(`The AI model returned an error (${response.status}).`);
  const body = (await response.json()) as {
    choices?: { message: { content: string | null; tool_calls?: ToolCall[] }; finish_reason: string }[];
  };
  const choice = body.choices?.[0];
  if (!choice) throw new ModelUnavailable("The AI model sent an empty answer.");
  return choice;
}
