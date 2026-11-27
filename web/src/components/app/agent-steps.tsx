import type { AgentStep } from "@/client/types";

const labels: Record<string, string> = {
  get_circle: "Read the circle",
  plan_round: "Ran the clearing solver",
  submit_round: "Submitted the round to the contract",
};

/** Pretty-prints a tool payload; falls back to the raw text. */
function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** The AI agent's tool calls, in order: what it asked for and what came back. Collapsed by default. */
export function AgentSteps({ steps, model }: { steps: readonly AgentStep[]; model?: string }) {
  if (steps.length === 0) return null;
  return (
    <details className="group rounded-lg border border-hairline">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-body-sm text-ink-strong [&::-webkit-details-marker]:hidden">
        How the agent decided ({steps.length} {steps.length === 1 ? "step" : "steps"})
        {model ? <span className="text-caption text-ink-subtle">{model}</span> : null}
      </summary>
      <ol className="flex flex-col gap-3 border-t border-hairline p-3">
        {steps.map((step, index) => (
          <li key={index} className="flex flex-col gap-2">
            <p className="text-label text-ink-strong">
              {index + 1}. {labels[step.tool] ?? step.tool}
            </p>
            <pre
              tabIndex={0}
              aria-label={`Step ${index + 1} input`}
              className="max-h-40 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-caption text-ink -outline-offset-2"
            >
              {pretty(step.input)}
            </pre>
            <pre
              tabIndex={0}
              aria-label={`Step ${index + 1} result`}
              className="max-h-56 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-caption text-ink -outline-offset-2"
            >
              {pretty(step.output)}
            </pre>
          </li>
        ))}
      </ol>
    </details>
  );
}
