import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

// Run after build: budgets cover every static dependency, not just the entry filename.
const root = new URL("../dist/client/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL(".vite/manifest.json", root), "utf8"),
);
test("first-screen JS and CSS stay within the reviewed loading budgets", () => {
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
  assert.ok(entry, "Built entry is missing; run npm run build first");
  const visited = new Set(),
    files = new Set(),
    css = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    files.add(chunk.file);
    for (const file of chunk.css || []) css.add(file);
    for (const dependency of chunk.imports || []) visit(dependency);
  }
  visit(entry);
  const bytes = (list) =>
    [...list].reduce(
      (sum, file) => sum + statSync(new URL(file, root)).size,
      0,
    );
  assert.ok(
    bytes(files) <= 800_000,
    `Initial JS is ${bytes(files)} bytes (budget 800,000)`,
  );
  assert.ok(
    bytes(css) <= 125_000,
    `Initial CSS is ${bytes(css)} bytes (budget 125,000)`,
  );
  for (const feature of [
    "src/RouteMap.jsx",
    "src/ActivityAnalysis.jsx",
    "src/Coach.jsx",
    "src/PlanCoach.jsx",
  ]) {
    assert.ok(
      manifest[feature]?.isDynamicEntry,
      `${feature} must load on demand`,
    );
    assert.equal(
      visited.has(feature),
      false,
      `${feature} leaked into first-screen dependencies`,
    );
  }
});
