// Feature pack — search/filter, CSV/JSON export, and deterministic domain
// insights over this app's own records. Pure helpers: no database, network,
// or AI provider calls, so they run identically offline.
const text = (value) => (value == null ? "" : String(value));

export function recordSearchText(row) {
  const payload = row?.payload && typeof row.payload === "object" ? Object.values(row.payload).map(text).join(" ") : "";
  return [row?.reference, row?.title, row?.status, row?.owner, row?.risk, payload].map(text).join(" ").toLowerCase();
}

export function filterRecords(rows, { q = "", status = "", risk = "" } = {}) {
  const query = text(q).trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (status && row.status !== status) return false;
    if (risk && row.risk !== risk) return false;
    if (query && !recordSearchText(row).includes(query)) return false;
    return true;
  });
}

const CSV_COLUMNS = ["id", "reference", "title", "status", "owner", "risk", "due_date", "amount", "payload"];
function csvCell(value) {
  if (value == null) return "";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}
export function toCsv(rows) {
  return [CSV_COLUMNS.join(","), ...(rows || []).map((row) => CSV_COLUMNS.map((col) => csvCell(row?.[col])).join(","))].join("\n");
}

export function exportPayload(rows, format = "json", base = "records") {
  if (format === "csv") return { contentType: "text/csv; charset=utf-8", filename: `${base}.csv`, body: toCsv(rows) };
  return { contentType: "application/json", filename: `${base}.json`, body: JSON.stringify(rows ?? [], null, 2) };
}

const OPEN_STATES = new Set(["Open", "Investigating", "Review"]);
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function pipelineSummary(records, label = "Records") {
  const rows = records || [];
  const byStatus = {};
  for (const row of rows) byStatus[row.status || "Unknown"] = (byStatus[row.status || "Unknown"] || 0) + 1;
  const totalValue = money(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
  const open = rows.filter((row) => OPEN_STATES.has(row.status)).length;
  return {
    id: "pipeline-summary", title: `${label} — pipeline summary`, aiGenerated: false,
    summary: `${rows.length} record(s) tracked, ${open} still open, representing ${totalValue} in recorded value.`,
    metrics: [
      { label: "Total records", value: rows.length },
      { label: "Open records", value: open },
      { label: "Closed records", value: byStatus.Closed || 0 },
      { label: "Total recorded value", value: totalValue },
      { label: "Has records", value: rows.length > 0 },
    ],
    sections: [
      { title: "Records by status", detail: Object.keys(byStatus).length ? Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(" · ") : "No records yet." },
      { title: "How this was produced", detail: "Deterministic count over saved records. No AI provider was called." },
    ],
    items: [],
  };
}

export function riskTriage(records, now = new Date()) {
  const rows = records || [];
  const highRisk = rows.filter((row) => ["High", "Critical"].includes(row.risk));
  const overdue = rows.filter((row) => row.due_date && OPEN_STATES.has(row.status) && new Date(row.due_date) < now);
  const evidenceGaps = rows.filter((row) => ["Exception", "Incomplete"].includes(row?.payload?.evidenceState));
  return {
    id: "risk-triage", title: "Risk & evidence triage", aiGenerated: false,
    summary: `${highRisk.length} high-risk, ${overdue.length} overdue-open, and ${evidenceGaps.length} evidence-gap record(s) need review.`,
    metrics: [
      { label: "High / critical risk", value: highRisk.length },
      { label: "Overdue and still open", value: overdue.length },
      { label: "Evidence exceptions or incomplete", value: evidenceGaps.length },
      { label: "Needs attention", value: highRisk.length + overdue.length + evidenceGaps.length > 0 },
    ],
    sections: [
      { title: "High-risk records", detail: highRisk.length ? highRisk.map((r) => `${r.reference} (${r.risk})`).join(" · ") : "None reported." },
      { title: "Overdue open records", detail: overdue.length ? overdue.map((r) => `${r.reference} due ${text(r.due_date).slice(0, 10)}`).join(" · ") : "None reported." },
      { title: "Evidence gaps", detail: evidenceGaps.length ? evidenceGaps.map((r) => `${r.reference} (${r.payload.evidenceState})`).join(" · ") : "None reported." },
    ],
    items: [...highRisk, ...overdue].slice(0, 10).map((r) => ({ reference: r.reference, title: r.title, status: r.status, risk: r.risk })),
  };
}

export function nextActions(records) {
  const rows = (records || []).filter((row) => OPEN_STATES.has(row.status))
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 5);
  return {
    id: "next-actions", title: "Next best actions (largest open first)", aiGenerated: false,
    summary: rows.length ? `${rows.length} open record(s) queued by recorded value.` : "No open records to action.",
    metrics: [
      { label: "Queued actions", value: rows.length },
      { label: "Largest open value", value: rows.length ? money(rows[0].amount) : 0 },
      { label: "Queue empty", value: rows.length === 0 },
    ],
    sections: [
      { title: "Action queue", detail: rows.length ? "Work the queue in order; validate evidence before any external submission." : "None reported." },
      { title: "How this was produced", detail: "Deterministic sort of open records by amount. No AI provider was called." },
    ],
    items: rows.map((r) => ({ reference: r.reference, title: r.title, amount: money(r.amount), action: `Validate evidence and progress ${r.reference} (${r.status}).` })),
  };
}

export function buildInsights(records, { featureTitle = "Records" } = {}) {
  return {
    aiGenerated: false,
    source: "deterministic-fallback",
    label: "Offline deterministic insight — no AI provider call (aiGenerated: false)",
    feature: featureTitle,
    features: [pipelineSummary(records, featureTitle), riskTriage(records), nextActions(records)],
  };
}
