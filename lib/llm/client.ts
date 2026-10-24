import type { z } from "zod";

/**
 * Minimal LLM client: Anthropic (Claude), Azure OpenAI, or any OpenAI-compatible
 * API such as Qwen, chosen by LLM_PROVIDER.
 * The LLM only does language work (extracting references, rewriting lines).
 * It never decides whether a reference lands — Qloo ranks do that.
 */
export interface LlmCall {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export async function completeText(call: LlmCall): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (provider === "azure") return azure(call);
  if (provider === "openai-compatible") return openaiCompatible(call);
  return anthropic(call);
}

/** Ask for JSON and validate it. Retries once with the validation error. */
export async function completeJson<T>(call: LlmCall, schema: z.ZodType<T>): Promise<T> {
  let user = `${call.user}\n\nRespond with JSON only. No prose, no code fences.`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await completeText({ ...call, user });
    const parsed = schema.safeParse(safeJson(text));
    if (parsed.success) return parsed.data;
    user = `${call.user}\n\nYour previous reply did not match the schema: ${parsed.error.message.slice(0, 400)}\nRespond with corrected JSON only.`;
  }
  throw new Error("LLM did not return valid JSON");
}

function safeJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

async function anthropic({ system, user, maxTokens = 1500, temperature = 0.2 }: LlmCall): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

async function azure({ system, user, maxTokens = 1500, temperature = 0.2 }: LlmCall): Promise<string> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const version = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
  if (!endpoint || !key || !deployment) throw new Error("Azure OpenAI env vars are not set");
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": key },
    body: JSON.stringify({
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Azure OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? "";
}

/** Any OpenAI-compatible API: Qwen (DashScope), OpenRouter, Together, Nebius… */
async function openaiCompatible({ system, user, maxTokens = 1500, temperature = 0.2 }: LlmCall): Promise<string> {
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !key || !model) throw new Error("LLM_BASE_URL, LLM_API_KEY and LLM_MODEL must be set");
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? "";
}
