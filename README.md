# knighthacks-2026
KnightHacks 2026 Submission

## Prerequisites

- Go 1.24 or later. `api/go.mod` sets `go 1.24`. The Go toolchain must be 1.24 or later to build the API.
- Node.js 20.9 or later. The `next` package in `frontend-digi/package-lock.json` (version 16.4.0) requires it. `frontend-digi/package.json` names no Node version, and the repo has no `.nvmrc` file.
- npm, which comes with Node.js. The repo pins no npm version. Use npm with the existing `frontend-digi/package-lock.json`, not yarn or pnpm.

## Start the API

Run these steps from a clean clone. The API reads its settings from `api/.env`.

1. Open a terminal in the `api/` folder:

   ```bash
   cd api
   ```

2. Copy the example settings file:

   ```bash
   cp .env.example .env
   ```

3. Edit `api/.env`. Set `VAST_API_KEY`, `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and `DATABRICKS_SQL_WAREHOUSE_ID`. Without keys, set `USE_VAST_FIXTURE=1` and `USE_DATABRICKS_FIXTURE=1` instead. See [Fixture modes](#fixture-modes).

4. Start the API:

   ```bash
   go run .
   ```

5. In another terminal, check the API:

   ```bash
   curl http://localhost:8000/api/health
   ```

   The response is `{"status":"ok"}`.

Run `go run .` from `api/`. The API reads `.env` from the current folder. It listens on `PORT`, which defaults to 8000. If a required setting is missing, the API stops and names it. A value that you set in your shell wins over the value in `.env`.
