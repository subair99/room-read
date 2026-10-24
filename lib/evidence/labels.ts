import type { EvidenceSource } from "./record";

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  qloo: "Qloo result",
  interpretation: "RoomRead interpretation",
  user_rule: "Your rule",
  llm: "AI-written text",
};

export const LIMIT_NOTE =
  "Affinity of an audience segment, not a prediction about any person. " +
  "RoomRead checks whether a reference is familiar and loved, not whether a joke is funny.";
