import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// No provider keys are read by the feature pack; it never calls a provider.
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
const { filterRecords, exportPayload, buildInsights } = await import("../featurePack.mjs");

const rows = [
  { id: 1, reference: "A-1", title: "Alpha review", status: "Open", owner: "Sam", risk: "High", due_date: "2020-01-01", amount: 0, payload: { evidenceState: "Exception", flag: false, note: "" } },
  { id: 2, reference: "B-2", title: "Beta closure", status: "Closed", owner: "Jo", risk: "Low", due_date: "2999-01-01", amount: 250, payload: { evidenceState: "Complete" } },
];

test("search/filter matches text, status, and risk", () => {
  assert.equal(filterRecords(rows, {}).length, 2);
  assert.equal(filterRecords(rows, { q: "alpha" }).length, 1);
  assert.equal(filterRecords(rows, { q: "exception" }).length, 1);
  assert.equal(filterRecords(rows, { status: "Closed" }).length, 1);
  assert.equal(filterRecords(rows, { risk: "High" }).length, 1);
  assert.equal(filterRecords(rows, { q: "missing" }).length, 0);
});

test("CSV export preserves 0 and empty values; JSON preserves false/0/empty", () => {
  const csv = exportPayload(rows, "csv", "x");
  assert.equal(csv.contentType, "text/csv; charset=utf-8");
  assert.ok(csv.body.includes("A-1,Alpha review,Open,Sam,High,2020-01-01,0"), csv.body);
  const json = JSON.parse(exportPayload(rows, "json", "x").body);
  assert.equal(json[0].amount, 0);
  assert.equal(json[0].payload.flag, false);
  assert.equal(json[0].payload.note, "");
});

test("deterministic insights are labelled aiGenerated:false and preserve 0/empty", () => {
  const out = buildInsights(rows, { featureTitle: "Register" });
  assert.equal(out.aiGenerated, false);
  assert.equal(out.features.length, 3);
  const triage = out.features.find((f) => f.id === "risk-triage");
  assert.equal(triage.metrics.find((m) => m.label === "High / critical risk").value, 1);
  const empty = buildInsights([], { featureTitle: "Register" });
  assert.equal(empty.features[0].metrics.find((m) => m.label === "Total records").value, 0);
  assert.equal(empty.features[0].metrics.find((m) => m.label === "Has records").value, false);
  assert.deepEqual(empty.features[2].items, []);
  assert.ok(empty.features.every((f) => f.sections.length >= 2));
});

test("routes, tasks search, and UI panels are wired behind auth", () => {
  const server = fs.readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.ok(server.includes("/api/features/:id/export"));
  assert.ok(server.includes("/api/features/:id/insights"));
  assert.ok(server.includes("filterRecords"));
  const tasks = fs.readFileSync(new URL("../tasks.mjs", import.meta.url), "utf8");
  assert.ok(tasks.includes("ILIKE"), "tasks list must support q search");
  const app = fs.readFileSync(new URL("../../frontend/src/App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("TasksPanel"));
  const workbench = fs.readFileSync(new URL("../../frontend/src/RecoveryWorkbench.jsx", import.meta.url), "utf8");
  assert.ok(workbench.includes("InsightsPanel"));
  assert.ok(workbench.includes("Search records"));
});
