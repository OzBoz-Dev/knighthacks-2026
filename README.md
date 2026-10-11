# knighthacks-2026
KnightHacks 2026 Submission

## Prerequisites

- Go 1.24 or later, to run the API. `api/go.mod` sets `go 1.24`. The frontend does not need Go.
- Node.js 24 LTS, to run the frontend. CI uses Node 24. Some wallet packages in `frontend-digi/package-lock.json` need Node 22.13, 24.3, or later, so Node 20 does not work.
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

## Start the frontend

Run these steps from a clean clone. The frontend reads its settings from `frontend-digi/.env.local`.

1. Open a terminal in the `frontend-digi/` folder:

   ```bash
   cd frontend-digi
   ```

2. Install the packages from the lockfile:

   ```bash
   npm ci
   ```

3. Copy the example settings file. If `.env.local` exists already, keep it and add the missing settings:

   ```bash
   cp .env.example .env.local
   ```

4. Check `NEXT_PUBLIC_API_URL` in `.env.local`. It must be the API address, normally `http://localhost:8000`.

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

The pages load without the API. Match and My Reservations need the API from [Start the API](#start-the-api) to show data. Explore does not read the API yet.

To see a sample Explore dashboard, start the dev server with the dev fixture flag:

```bash
NEXT_PUBLIC_USE_DEV_FIXTURES=1 npm run dev
```

The sample data is synthetic and the page labels it as sample data. The flag works only with `npm run dev`. A production build never loads the samples. The flag does not mock Match or My Reservations.

To use another port, run `npm run dev -- -p 3100`. Then add the same origin to `ALLOWED_ORIGIN` in `api/.env`, for example `http://localhost:3000,http://localhost:3100`, so the API accepts the requests.

Restart the dev server after you change `.env.local`. A production build (`npm run build`) reads the `NEXT_PUBLIC_` values when it builds, so build again after a change.

## Environment variables

Two files hold settings. Never commit either file. Restart the API or the web dev server after you change a value.

| File | Read by |
|---|---|
| `api/.env` | The Go API. Copy it from `api/.env.example`. |
| `frontend-digi/.env.local` | The web app. Copy it from `frontend-digi/.env.example`. Next.js reads it. |

### API settings (`api/.env`)

| Variable | Secret | Where it runs | Default | Purpose |
|---|---|---|---|---|
| `PORT` | No | Server | `8000` | Port the API listens on. |
| `ALLOWED_ORIGIN` | No | Server | `http://localhost:3000` | Comma-separated web origins that the API allows (CORS). |
| `DB_PATH` | No | Server | `data/digigpu.db` | SQLite database file. |
| `SNAPSHOT_DIR` | No | Server | `data/snapshots` | Folder for saved market snapshots. |
| `VAST_API_KEY` | Yes | Server only | None. Required unless `USE_VAST_FIXTURE=1`. | Vast.ai API key. |
| `USE_VAST_FIXTURE` | No | Server | `0` | Set to `1` to use saved Vast.ai data. |
| `DATABRICKS_HOST` | Yes | Server only | None. Required unless `USE_DATABRICKS_FIXTURE=1`. | Databricks workspace URL. |
| `DATABRICKS_TOKEN` | Yes | Server only | None. Required unless `USE_DATABRICKS_FIXTURE=1`. | Databricks access token. |
| `DATABRICKS_SQL_WAREHOUSE_ID` | Yes | Server only | None. Required unless `USE_DATABRICKS_FIXTURE=1`. | Databricks SQL warehouse ID. |
| `USE_DATABRICKS_FIXTURE` | No | Server | `0` | Set to `1` to use a saved Databricks export. |
| `SOLANA_RPC_URL` | No | Server | `https://api.devnet.solana.com` | Solana RPC URL. The API stops if it does not contain `devnet`. |

### Web app settings (`frontend-digi/.env.local`)

| Variable | Secret | Where it runs | Default | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | Browser | None. Required. | API base URL, for example `http://localhost:8000`. |
| `NEXT_PUBLIC_SOLANA_RPC` | No | Browser | `https://api.devnet.solana.com` | Solana devnet RPC URL for the browser. The app refuses a URL that names mainnet. |
| `NEXT_PUBLIC_USE_DEV_FIXTURES` | No | Browser | Unset | Set to `1` to show a sample dashboard. It works only with `npm run dev`. |

Every `NEXT_PUBLIC_` value reaches the browser. Never put a key or token in one.

### Fixture modes

- `USE_VAST_FIXTURE=1`: The API uses saved Vast.ai data in place of live calls. It does not need `VAST_API_KEY`. The API marks this data as `vast-saved`, not `vast-live`.
- `USE_DATABRICKS_FIXTURE=1`: The API uses a saved Databricks export in place of live queries. It does not need the three Databricks settings. The API marks this data as `databricks-export`.
- `NEXT_PUBLIC_USE_DEV_FIXTURES=1`: The web app shows a populated sample dashboard. It works only with `npm run dev`. Without this flag, the app shows honest unavailable states.

## Project docs

- [prd.md](prd.md): product scope, architecture, frozen contract, and the team plan.
- [AGENTS.md](AGENTS.md): rules for branches, commits, pull requests, and code.
