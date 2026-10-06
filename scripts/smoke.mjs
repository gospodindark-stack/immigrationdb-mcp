#!/usr/bin/env node
// Smoke test for the live ImmigrationDB MCP endpoint. No dependencies; Node 20+.
//
//   node scripts/smoke.mjs                 # check the live endpoint
//   node scripts/smoke.mjs --write-tools   # also refresh tools.json from tools/list
//   MCP_URL=http://127.0.0.1:8787/mcp node scripts/smoke.mjs

import { writeFile } from "node:fs/promises";

const URL_ = process.env.MCP_URL || "https://immigrationdb.com/mcp";
const PROTOCOL = process.env.MCP_PROTOCOL || "2025-11-25";
const EXPECTED_TOOLS = [
  "search_destinations", "get_city", "get_country", "search_visa_routes", "get_legal_route",
  "search_entry_rules", "get_entry_rule", "list_reports", "get_report", "resolve_city",
  "get_city_fact", "list_metrics", "list_blocks", "compare_cities", "search_facts",
];
const CALLS = [
  ["resolve_city", { query: "Berlin, Germany", limit: 3 }],
  ["get_city_fact", { country: "de", slug: "berlin", metric_id: "population_total" }],
  ["compare_cities", { cities: [{ country: "de", slug: "berlin" }, { country: "de", slug: "munich" }], metric_ids: ["population_total"] }],
  ["search_visa_routes", { destination: "de", purpose: "work", limit: 3 }],
  ["get_entry_rule", { passport: "lv", destination: "us" }],
  ["list_reports", { limit: 3 }],
];

let sessionId = null;
let nextId = 1;

async function post(body) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL,
    "user-agent": "immigrationdb-mcp-smoke",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const response = await fetch(URL_, { method: "POST", headers, body: JSON.stringify(body) });
  sessionId = response.headers.get("mcp-session-id") || sessionId;
  const text = await response.text();
  if (!response.ok && response.status !== 202) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  if (!text) return null;
  const event = text.match(/^data: (.*)$/m);
  return JSON.parse(event ? event[1] : text);
}

async function rpc(method, params = {}) {
  const message = await post({ jsonrpc: "2.0", id: nextId++, method, params });
  if (message.error) throw new Error(`${method}: ${message.error.code} ${message.error.message}`);
  return message.result;
}

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(label);
};

const init = await rpc("initialize", {
  protocolVersion: PROTOCOL,
  capabilities: {},
  clientInfo: { name: "immigrationdb-mcp-smoke", version: "1.0.0" },
});
check(init.serverInfo?.name === "immigrationdb", `initialize: ${init.serverInfo?.name} ${init.serverInfo?.version}, protocol ${init.protocolVersion}`);
await post({ jsonrpc: "2.0", method: "notifications/initialized" });

const { tools } = await rpc("tools/list");
const names = tools.map((tool) => tool.name);
check(EXPECTED_TOOLS.every((name) => names.includes(name)) && names.length === EXPECTED_TOOLS.length, `tools/list: ${names.length} tools`);
check(tools.every((tool) => tool.annotations?.readOnlyHint === true), "every tool is annotated read-only");

for (const [name, args] of CALLS) {
  try {
    const result = await rpc("tools/call", { name, arguments: args });
    const payload = JSON.parse(result.content?.[0]?.text || "{}");
    check(!result.isError && Boolean(payload.snapshot_id), `${name}: snapshot ${payload.snapshot_id}`);
  } catch (error) {
    check(false, `${name}: ${error.message}`);
  }
}

const templates = await rpc("resources/templates/list");
check(templates.resourceTemplates.length >= 4, `resources/templates/list: ${templates.resourceTemplates.map((t) => t.uriTemplate).join(", ")}`);

if (process.argv.includes("--write-tools")) {
  const file = new URL("../tools.json", import.meta.url);
  const contract = {
    endpoint: URL_,
    server: init.serverInfo,
    protocol_version: init.protocolVersion,
    tools: tools.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })),
    resource_templates: templates.resourceTemplates,
  };
  await writeFile(file, `${JSON.stringify(contract, null, 2)}\n`);
  console.log(`wrote ${file.pathname}`);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
