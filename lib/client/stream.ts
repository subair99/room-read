import type { AgentEvent } from "../types";

/** Turn a failed response into a readable message, even when it's an HTML error page. */
async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 504 || res.status === 502) return "The server took too long to answer. Try again: results so far are cached, so it'll be quicker.";
  if (res.status === 429) return "Too many requests. Wait a minute, or use judge mode.";
  return `Server error (${res.status}). Try again.`;
}

/** Read an SSE body, calling onData for each `data:` line. Comment lines (keep-alives) are ignored. */
async function readSse(res: Response, onData: (json: unknown) => void): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) onData(JSON.parse(line.slice(6)));
      }
    }
  }
}

/** POST JSON and stream agent events (check, bridge, tour). */
export async function streamAgent(url: string, body: unknown, onEvent: (e: AgentEvent) => void): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: await readError(res) });
    return;
  }
  await readSse(res, (j) => onEvent(j as AgentEvent));
}

/** POST JSON to a long-running endpoint that streams keep-alives, then one result. */
export async function fetchResult<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(await readError(res));
  let result: T | undefined;
  let error: string | undefined;
  await readSse(res, (j) => {
    const e = j as { type: string; data?: T; message?: string };
    if (e.type === "result") result = e.data;
    if (e.type === "error") error = e.message;
  });
  if (error) throw new Error(error);
  if (result === undefined) throw new Error("The connection closed before a result arrived. Try again.");
  return result;
}
