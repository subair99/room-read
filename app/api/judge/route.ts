import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

/** Judge mode: list the five preloaded scripts (and cached results if captured). */
export async function GET() {
  const dir = join(process.cwd(), "fixtures", "judge-mode");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const items = await Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8"))));
  return Response.json({ items });
}
