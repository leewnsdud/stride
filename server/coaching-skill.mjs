import { readFileSync } from "node:fs";
const root = new URL("../skills/running-coach/", import.meta.url);
const core = readFileSync(new URL("SKILL.md", root), "utf8").replace(
  /^---\n[\s\S]*?\n---\n/,
  "",
);
const references = Object.fromEntries(
  ["road", "race", "trail", "period"].map((key) => [
    key,
    readFileSync(new URL(`references/${key}.md`, root), "utf8"),
  ]),
);
export const COACHING_VERSION = "running-coach/1.1";
export function coachingSkill(context) {
  const scenarios = context.scenario
    ? [context.scenario]
    : (context.activities || []).map((a) => a.scenario);
  const modes = context.scope?.kind === "none" ? [] : ["road"];
  if (scenarios.some((s) => s?.race)) modes.push("race");
  if (scenarios.some((s) => s?.trail)) modes.push("trail");
  if (
    context.scope?.kind !== "none" &&
    context.scope?.kind !== "activity" &&
    !context.activity
  )
    modes.push("period");
  return {
    version: COACHING_VERSION,
    modes,
    instructions: [core, ...modes.map((m) => references[m])].join("\n\n"),
  };
}
