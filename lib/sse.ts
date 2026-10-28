import type { AgentEvent } from "./types";

/**
 * Proxies and load balancers (e.g. Lightsail's) close connections that sit
 * idle too long and return their own HTML error page. Every streamed response
 * sends an SSE comment line this often, so long Qloo/LLM work never looks idle.
 */
export const KEEPALIVE_MS = 10_000;

const HEADERS = { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" };

/** Stream agent events to the browser as server-sent events. */
export function sseResponse(run: (emit: (e: AgentEvent) => void) => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      const emit = (e: AgentEvent) => send(`data: ${JSON.stringify(e)}\n\n`);
      const timer = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);
      try {
        await run(emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        clearInterval(timer);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: HEADERS });
}

/**
 * For requests that return ONE JSON result after long work (baseline, swap-all):
 * stream keep-alives while working, then a single `result` (or `error`) event.
 * The browser reads it with fetchResult() in lib/client/stream.ts.
 */
export function jsonStreamResponse(run: () => Promise<unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      const timer = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);
      send(": started\n\n");
      try {
        const data = await run();
        send(`data: ${JSON.stringify({ type: "result", data })}\n\n`);
      } catch (err) {
        send(`data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : String(err) })}\n\n`);
      } finally {
        clearInterval(timer);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: HEADERS });
}
