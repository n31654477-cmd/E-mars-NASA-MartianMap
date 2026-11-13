# Mars Source Explorer

A source-preserving research explorer for the NASA Drive folder containing USGS SIM3292 Mars GIS data and PDFs.

## Run & Operate

- Web preview: managed workflow `artifacts/nasa-data-explorer: web`.
- Extraction: `research/extract_nasa.py`; final report and bundles: `research/finalize_nasa.py`.
- Large raw files, generated archives, and web data are excluded from Git/deployments. App Storage provisioning failed; configure durable storage before publishing.
- Extraction requires the Python GIS/PDF packages declared in `pyproject.toml` and an Expat shared library compatible with Python. See agent memory for the native-library caveat.

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- This explorer is a static extraction snapshot, not a live Drive synchronization app. It does not need a database.
- Scientific fidelity takes precedence over combining data: keep each source/version distinct, preserve original values, and cite filenames plus layers or physical PDF pages.
- Exact fixed-width DBF strings are exported separately from typed JSON to preserve decimal spelling and padding.
- Do not reproject, join, deduplicate, simplify geometry, or convert units without explicitly explaining the change.
- Reusable datasets use JSON literals stored as spreadsheet text, not automatic Excel numeric/date cells. This preserves decimal representations, type distinctions, and source strings against Excel's precision limits and coercion. Long cells are explicitly chunked, never truncated.
- Rebuild document/spreadsheet packages with `research/build_dataset.py`; validate extracted packages using their portable `verify_dataset.py`. Integrity checks do not certify PDF semantic interpretation or scientific correctness.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
