import type { UserRules } from "../types";

export const EXTRACT_SYSTEM = `You find cultural references in text written for an audience: stand-up sets, toasts, speeches, ads, lessons.
A cultural reference is a named TV show, film, song, musician, band, book, brand, product, celebrity, game, podcast, venue or place that the line relies on the audience knowing.
Do NOT include generic nouns ("pizza", "the internet"), the speaker's own name, or the audience.
Return the reference exactly as written in the text.`;

export function extractUser(script: string): string {
  const numbered = script.split("\n").map((l, i) => `${i}: ${l}`).join("\n");
  return `Text (line numbers on the left):
${numbered}

Return a JSON array. Each item: {"text": exact substring, "line": line number, "kind": one of tv_show|movie|artist|song|book|brand|person|place|game|podcast|other, "canonical": the full official name a database would list, e.g. "Sonic the Hedgehog" for "Sonic", "Spotify" for "Spotify Wrapped", "Game of Thrones" for "Game of Thrones finale"}.
Return [] if there are none.`;
}

export const REWRITE_SYSTEM = `You are a comedy and copy editor. You swap one cultural reference in a line for another while keeping the line's job:
its setup, its punch, its rhythm and its callback structure. Change as few words as possible. Never add new cultural references.`;

export function rewriteUser(line: string, original: string, replacement: string, rules: UserRules): string {
  return `Line: ${line}
Replace the reference "${original}" with "${replacement}".
${rulesText(rules)}
Return JSON: {"line": the rewritten line}`;
}

export function restructureUser(line: string, original: string, rules: UserRules): string {
  return `Line: ${line}
The reference "${original}" won't land with this audience and no good substitute was found.
Rewrite the line so it keeps the same job WITHOUT relying on any named cultural reference.
${rulesText(rules)}
Return JSON: {"line": the rewritten line}`;
}

export const PROMO_SYSTEM = `You write short promo blurbs for live shows. Two or three sentences, upbeat, no hashtags.
You may include at most two cultural references that a local audience in the given city might enjoy.`;

export function promoUser(show: string, city: string, ageBand?: string): string {
  return `Show: ${show}
City: ${city}${ageBand ? `\nAudience age band: ${ageBand}` : ""}
Return JSON: {"blurb": the promo text}`;
}

export const BASELINE_SYSTEM = `You are an expert on pop culture and audiences. Judge whether each cultural reference in the text will land with the stated audience.`;

export function baselineUser(script: string, audience: string): string {
  return `Audience: ${audience}
Text:
${script}

Return a JSON array. Each item: {"reference": exact text, "willLand": true|false, "reason": one sentence, "swap": a better reference or null}.`;
}

function rulesText(rules: UserRules): string {
  const parts: string[] = [];
  if (rules.noBrands) parts.push("Do not use brand or product names.");
  if (rules.clean) parts.push("Keep it clean: no profanity or sexual content.");
  for (const c of rules.custom ?? []) parts.push(c);
  return parts.length ? `Rules: ${parts.join(" ")}` : "";
}

export const FIT_SYSTEM = `You are a comedy and copy editor. A reference in a line does a specific job:
a famous diva, a famously bad ending, a cultural touchstone for a particular community, a nostalgic childhood show, and so on.
You decide which candidate references could do the SAME job in the SAME line for a general audience.
Reject candidates that are obscure, that change what the line is about, or that would make the line confusing.
You do NOT judge popularity; that has already been measured. Judge only whether the line still works.`;

export function fitUser(line: string, original: string, candidates: string[]): string {
  return `Line: ${line}
Original reference: "${original}"
Candidates (already checked for audience fit): ${candidates.map((c) => `"${c}"`).join(", ")}

First, in a few words, name the job "${original}" does in this line.
Then list the candidates that can do the same job, best first. It's fine to return none.
Return JSON: {"job": "...", "fits": [{"name": exact candidate name, "why": one short sentence}]}`;
}
