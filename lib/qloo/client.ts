import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { QlooEnvelopeSchema, type QlooEnvelope } from "./schemas";

/**
 * One long-lived `qloo mcp` child process per server, reused by every request.
 * The key stays in this process's environment and never reaches the browser.
 */
type Holder = { promise: Promise<Client> | null };
const g = globalThis as unknown as { __qloo?: Holder };
const holder: Holder = (g.__qloo ??= { promise: null });

function childEnv(): Record<string, string> {
  // Pass the server's env through (the kit requires env: process.env so
  // QLOO_API_KEY reaches the child). Drop undefined values for the SDK type.
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") env[k] = v;
  return env;
}

async function connect(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.env.QLOO_BIN || "qloo",
    args: ["mcp"],
    env: childEnv(),
  });
  const client = new Client({ name: "roomread", version: "0.1.0" });
  await client.connect(transport);
  transport.onclose = () => {
    holder.promise = null; // reconnect on next call
  };
  return client;
}

export function getQloo(): Promise<Client> {
  if (!holder.promise) {
    holder.promise = connect().catch((err) => {
      holder.promise = null;
      throw err;
    });
  }
  return holder.promise;
}

/** Per-call limit. A hung call becomes a retryable error instead of blocking for 60 s. */
export const QLOO_TIMEOUT_MS = Number(process.env.QLOO_TIMEOUT_MS || 25_000);

/** Call one harness tool and parse the standard envelope. */
export async function callQlooTool(name: string, args: Record<string, unknown>): Promise<QlooEnvelope> {
  const client = await getQloo();
  let res: unknown;
  try {
    res = await client.callTool({ name, arguments: args }, undefined, { timeout: QLOO_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = /timed out|-32001/i.test(msg);
    return {
      status: "error",
      summary: timedOut ? `Qloo took longer than ${QLOO_TIMEOUT_MS / 1000}s` : msg,
      results: [],
      result_count: 0,
      error: { code: timedOut ? "QLOO_TIMEOUT" : "QLOO_TRANSPORT", retryable: timedOut },
    };
  }
  return parseResult(res);
}

function parseResult(res: unknown): QlooEnvelope {
  const r = res as {
    structuredContent?: unknown;
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  const raw = r.structuredContent ?? parseTextContent(r.content);
  return QlooEnvelopeSchema.parse(raw) as QlooEnvelope;
}

function parseTextContent(content?: Array<{ type: string; text?: string }>): unknown {
  const text = content?.find((c) => c.type === "text")?.text;
  if (!text) return { status: "error", summary: "Empty response from qloo mcp", results: [], result_count: 0 };
  try {
    return JSON.parse(text);
  } catch {
    return { status: "error", summary: text.slice(0, 300), results: [], result_count: 0 };
  }
}

/** Used by the spike and /api/health: list tools and their input schemas. */
export async function listQlooTools() {
  const client = await getQloo();
  return client.listTools();
}
