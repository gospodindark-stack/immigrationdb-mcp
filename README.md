# ImmigrationDB MCP

Read-only [Model Context Protocol](https://modelcontextprotocol.io) server for
[ImmigrationDB](https://immigrationdb.com/), a sourced migration reference:
39 countries and 27,000+ cities, visa and residence routes, passport entry
answers, cost of living, salaries, crime, air quality and climate. Every value
carries its source, observation date and geographic grain. The server reads the
same release as the website.

- **Live endpoint (Streamable HTTP, no key, no account):** `https://immigrationdb.com/mcp`
- **Protocol versions:** `2026-07-28`, `2025-11-25`
- **Docs:** `https://immigrationdb.com/data/mcp/`
- **Tool catalog with input schemas:** `https://immigrationdb.com/data/mcp/catalog.json`
- **Methodology:** `https://immigrationdb.com/methodology/`
- **Agent index:** `https://immigrationdb.com/llms.txt`

This repository holds the public contract of the hosted server: client
configuration, the tool list with input schemas ([`tools.json`](tools.json)),
registry metadata ([`server.json`](server.json)) and a dependency-free smoke
test. The service runs only as the hosted endpoint above; its data release is
several gigabytes and is published as files at
`https://immigrationdb.com/data/mcp/`.

## Tools

| Tool | Arguments | What it does |
|---|---|---|
| `search_destinations` | `query`, `limit`, `cursor` | Search countries and cities. |
| `resolve_city` | `query`, `limit` | Resolve a city name to ranked candidates; never picks an ambiguous country silently. |
| `get_city` | `country`, `slug`, `detail`, `metric_ids` | One city with claim-level facts and source metadata. |
| `get_city_fact` | `country`, `slug`, `metric_id` | Exactly one fact: value, unit, grain, dates, source. |
| `compare_cities` | `cities`, `metric_ids` | Compare cities on compatible metrics, with provenance for every cell. |
| `search_facts` | `countries`, `filters`, `sort_metric`, `sort_order`, `limit`, `cursor`, `diagnostic` | Numeric filters over city facts with explicit counts. |
| `list_metrics` | `country`, `block`, `query`, `comparison_eligible`, `limit`, `cursor` | Metric definitions and their coverage. |
| `list_blocks` | `country`, `limit`, `cursor` | Metric blocks with coverage. |
| `get_country` | `cc` | One country record with official visa-route links. |
| `search_visa_routes` | `destination`, `purpose`, `limit`, `cursor` | Visa and residence routes of a destination. |
| `get_legal_route` | `destination`, `route_id` | One route with its official source. |
| `search_entry_rules` | `passport`, `destination`, `purpose`, `limit`, `cursor` | Passport entry rules; unknown answers stay explicit. |
| `get_entry_rule` | `passport`, `destination` | One passport entry rule. |
| `list_reports` | `category`, `limit`, `cursor` | Published reports (largest cities, cheapest rent, cleanest air…). |
| `get_report` | `report_id` | One report with its rows, method and sources. |

Optional arguments are listed with the required ones; [`tools.json`](tools.json) has the full
input schemas. Country arguments are ISO 3166-1 alpha-2 codes (`de`, `lv`, `us`); city
arguments are canonical slugs (`berlin`), not display names. All tools are
annotated read-only and idempotent.

## Resources

- `immigrationdb://country/{cc}` — country record and route links
- `immigrationdb://city/{country}/{slug}` — city facts with source metadata
- `immigrationdb://legal/routes/{country}/{route_id}` — one visa or residence route
- `immigrationdb://legal/entry/{passport}/{destination}` — one passport entry answer
- `immigrationdb://legal/entry/{passport}` — all entry answers for a passport
- `immigrationdb://report/{report_id}` — report rows, method and sources

## Client configuration

Any MCP client that supports Streamable HTTP:

```json
{
  "mcpServers": {
    "immigrationdb": {
      "url": "https://immigrationdb.com/mcp"
    }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http immigrationdb https://immigrationdb.com/mcp
```

Clients that only speak stdio can go through
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote):
`npx -y mcp-remote https://immigrationdb.com/mcp`.

## Example calls

```json
{ "tool": "resolve_city", "arguments": { "query": "Berlin, Germany", "limit": 5 } }
{ "tool": "get_city_fact", "arguments": { "country": "de", "slug": "berlin", "metric_id": "population_total" } }
{ "tool": "compare_cities", "arguments": { "cities": [{ "country": "de", "slug": "berlin" }, { "country": "de", "slug": "munich" }], "metric_ids": ["population_total"] } }
{ "tool": "search_facts", "arguments": { "countries": ["de"], "filters": [{ "metric_id": "population_total", "op": ">", "value": 100000 }], "sort_metric": "population_total", "sort_order": "desc", "limit": 20 } }
{ "tool": "get_entry_rule", "arguments": { "passport": "lv", "destination": "us" } }
```

## Response contract

Every response carries the snapshot ID, its generation date and the canonical
origin. Facts keep their value, unit, geographic grain, observation date,
verification date, source ID, source URL and grade. Unknown or withheld values
are returned as such and never estimated. Errors name the requested identifier
and the snapshot ID. Rate limits and response-size caps apply per client.

## Smoke test

Node 20 or newer, no install step:

```bash
node scripts/smoke.mjs                 # initialize, list tools, run six example calls
node scripts/smoke.mjs --write-tools   # also refresh tools.json from the live server
```

## License

The files in this repository are [MIT](LICENSE). The ImmigrationDB data is
published under [CC BY 4.0](https://immigrationdb.com/about/copyright/):
credit ImmigrationDB and link to the page or resource you used. The underlying
official sources keep their own terms; each value names its publisher and links
to it.

ImmigrationDB is an independent reference. It gives no legal advice and sells
no visa or immigration services; check current requirements with the
responsible authority before acting.
