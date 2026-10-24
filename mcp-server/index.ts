import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { cultureCheck } from "./cultureCheck";

/**
 * Exposes RoomRead's check as an MCP tool so any writing agent can call
 * culture_check(text, audience) before it publishes.
 * Run: npm run mcp   (needs QLOO_API_KEY and an LLM key in the environment)
 */
const server = new McpServer({ name: "roomread", version: "0.1.0" });

const AgeBand = z.enum(["18-34", "35-54", "55+"]);

server.tool(
  "culture_check",
  "Check whether the cultural references in a piece of text will be familiar to and loved by an audience (age band and/or city), using Qloo rankings. Add a second audience to find references that work for both.",
  {
    text: z.string().min(1).max(4000),
    ageBand: AgeBand.optional(),
    city: z.string().optional(),
    ageBandB: AgeBand.optional(),
    cityB: z.string().optional(),
    noBrands: z.boolean().optional(),
  },
  async (args) => {
    const out = await cultureCheck({ ...args, rules: { noBrands: args.noBrands } });
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
