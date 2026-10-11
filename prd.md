# solGPU — Hackathon PRD

**Build window:** 12 hours · **Team:** 4 students · **Demo:** 6 minutes

> **Explore live GPU prices, find the best option for your requirements, and keep a verifiable reservation receipt.**

solGPU makes GPU marketplaces easier to understand. It presents live Vast.ai inventory, uses Databricks to turn repeated market snapshots into pricing insights, recommends suitable offers with transparent rules, and records reservation intent on Solana devnet.

---

## 1. Product scope

solGPU has exactly three product features.

### 1. Explore
Browse GPU inventory, compare hourly prices, filter by hardware and region, and visualize market pricing trends.

### 2. Match
Specify VRAM requirements and a budget to receive ranked recommendations with transparent explanations of price and suitability.

### 3. My Reservations
Connect Phantom, sign a reservation-intent transaction on Solana devnet, and track verifiable on-chain receipts.

Anything that does not improve one of these three screens is out of scope.

---

## 2. User problem

Renting a cloud GPU is confusing:

- Marketplace listings expose many technical fields at once.
- Prices for the same GPU vary across hosts and regions.
- A user may not know which offers satisfy their memory requirement.
- A cheap listing may have weak reliability or poor price-to-performance.
- A saved screenshot or database row does not independently prove what the user selected.

solGPU turns raw marketplace inventory into a simple journey:

1. **See the market.**
2. **Enter requirements.**
3. **Understand the recommendation.**
4. **Sign and save the reservation intent.**

This is the BNY story in plain language: solGPU improves the process of comparing, selecting, and documenting a financial decision. Do not force banking jargon into the presentation.

---

## 3. Why each technology earns its place

### Vast.ai: live inventory
Vast.ai supplies the real listings being explored and matched. We use real offer IDs, GPU models, prices, VRAM, locations, reliability, and performance fields.

### Databricks: GPU market intelligence
A single Vast.ai response shows what is available now, but it does not answer:

- Is this price low or high for this GPU?
- How wide is the market price range?
- Is one region consistently cheaper?
- Has the typical price changed during the event?

Databricks answers those questions by transforming repeated raw marketplace snapshots into usable pricing benchmarks and trends.

#### Databricks pipeline

```text
Vast.ai snapshots every 10 minutes
              ↓
Bronze: raw offers exactly as collected
              ↓
Silver: typed, cleaned, deduplicated offers with canonical GPU/region names
              ↓
Gold: price benchmarks and trend points consumed by solGPU
```

Gold outputs:

1. `gpu_market_summary`
   - GPU model
   - listing count
   - minimum hourly price
   - median hourly price
   - p90 hourly price
   - median reliability
   - latest snapshot time

2. `gpu_price_trends`
   - snapshot time
   - GPU model
   - region
   - minimum, median, and p90 hourly price
   - listing count

3. `offer_market_position`
   - offer ID
   - percentage above or below the median for the same GPU model
   - price percentile
   - value score combining price, performance, and reliability

#### Where the app uses these outputs
- **Explore:** Lowest / Typical / High cards and the price trend chart come from Databricks gold tables.
- **Explore:** each listing can say “18% below the typical RTX 4090 price.”
- **Match:** explanations use Databricks market position, such as “lowest-priced suitable offer” or “12% below the typical price for this GPU.”

This is not ML for its own sake. Databricks converts noisy marketplace history into insights and actions the user sees directly.

### Solana: reservation-intent receipts
A reservation is not a real Vast.ai booking and does not transfer money. It is a signed statement that the user selected a specific offer at a specific quoted price.

The Phantom-signed Solana devnet transaction contains a Memo with the hash of the reservation intent. The receipt can then verify:

- which wallet signed;
- which offer and quoted price were accepted;
- when the intent was confirmed;
- that the stored reservation still matches the on-chain hash.

Use devnet only. Test SOL is required only for the network fee and has no monetary value.

---

## 4. Six-minute demo

Target **5:15** and preserve 45 seconds for delays or questions.

| Time | Screen | Demo action |
|---|---|---|
| 0:00–0:30 | Explore | “The same GPU can have very different prices depending on the host and region. solGPU makes that market easy to compare.” |
| 0:30–1:50 | Explore | Show live Vast.ai inventory. Filter by GPU, VRAM, region, and price. Point out Lowest / Typical / High cards and the Databricks-powered trend chart. Use actual values, not invented statistics. |
| 1:50–3:15 | Match | Enter 24 GB VRAM and a $2/hour budget. Show the top three suitable offers and their explanations. “This option meets the memory requirement, is 14% below the typical price for this model, and has 99.2% reliability.” |
| 3:15–3:40 | Databricks proof | Expand “How pricing insights are calculated,” then briefly show the pre-opened Databricks gold table or dashboard. “Every point in the chart and every market comparison comes from this snapshot pipeline.” |
| 3:40–4:50 | My Reservations | Open the top match, connect Phantom on devnet, click Reserve, approve the memo transaction, and show the confirmed receipt and Explorer link. |
| 4:50–5:15 | Receipt verification | Click Verify on the reservation card. Show signer, offer, price, timestamp, and on-chain hash checks. |
| 5:15–5:30 | Close | “solGPU helps you explore the GPU market, choose with confidence, and preserve what you selected.” |

### Demo rule
The product always labels its data source:

- `Live Vast.ai inventory`
- `Databricks insights updated at {time}`
- `Saved market snapshot from {time}` for saved Vast.ai inventory
- `Exported Databricks insights from {time}` for the saved gold export

Never present fixture data as live.

---

## 5. Feature requirements

### 5.1 Explore

#### Must
- Offers table using normalized Vast.ai data.
- Columns: GPU, GPU count, VRAM per GPU, region, hourly price, reliability, performance score, verified host.
- Filters:
  - GPU model
  - minimum VRAM per GPU
  - maximum hourly price
  - region
  - minimum reliability
  - verified only
- Sorting:
  - hourly price
  - reliability
  - performance per dollar
- Databricks summary cards for the selected GPU:
  - Lowest
  - Typical (median)
  - High (p90)
  - Listing count
- Databricks trend chart: median price over time with a p10–p90 band.
- Market-position badge where available:
  - `Good price` at least 15% below median
  - `Near typical` between −15% and +15%
  - `Above typical` more than 15% above median
- Source and update timestamp.

#### Empty and error states
- Vast unavailable: load the most recent real saved snapshot and label it.
- Databricks unavailable: keep the offers table working; hide insights behind “Pricing insights temporarily unavailable.”
- No filter results: show which active filter removed the most offers and provide Reset Filters.

### 5.2 Match

#### Inputs
- Minimum VRAM per GPU in GB, sent as `min_vram_gb`.
- Maximum hourly budget.
- Optional GPU-model allowlist.
- Optional region.
- Minimum reliability, default 95%.
- Priority:
  - Cheapest
  - Balanced
  - Performance

#### Hard eligibility filters
Apply in this order and count the first reason each offer fails:

1. GPU model, if specified.
2. Region, if specified.
3. VRAM per GPU (`gpu_ram_gb`).
4. Reliability.
5. Hourly budget.

#### Ranking
Normalize each eligible offer to 0–100 for:

- `price`: lower is better;
- `performance`: Vast.ai `dlperf`, higher is better;
- `reliability`: higher is better.

Weights:

| Priority | Price | Performance | Reliability |
|---|---:|---:|---:|
| Cheapest | 60% | 20% | 20% |
| Balanced | 40% | 35% | 25% |
| Performance | 20% | 60% | 20% |

Tie-breaker: lower hourly price, then higher reliability, then offer ID.

The ranking is deterministic. The same snapshot and request must return the same order.

#### Results
- Top five ranked offers.
- Score and score breakdown.
- Two to four plain-language explanations per offer.
- Summary: `Checked N offers · M meet your requirements`.
- Exclusion counts for VRAM, budget, reliability, region, and model.
- Reserve button on each result.

Example explanations:
- “24 GB VRAM meets your 20 GB requirement.”
- “$0.82/hour, 18% below the typical price for an RTX 4090.”
- “99.2% reliability.”
- “Best performance-per-dollar among the suitable offers.”

If no offers qualify, use the largest exclusion count to suggest one change, such as raising the budget.
The API does not return the eligibility threshold or its internal suggestion. Do not invent a price or VRAM value that would make an offer qualify.

### 5.3 My Reservations

#### Reserve flow
1. User connects Phantom.
2. Backend creates a pending reservation and returns an exact canonical payload and SHA-256 hash.
3. Frontend verifies the hash locally.
4. Phantom signs a Solana devnet transaction containing a Memo:

   ```text
   SG1|<reservation_id>|<payload_hash>
   ```

5. Frontend confirms the transaction.
6. Backend independently verifies the signer and memo before marking the reservation confirmed.
7. UI opens My Reservations with the new receipt.

#### Reservation card
- GPU model and offer ID.
- Quoted hourly price.
- Selected requirements: VRAM, budget, priority, and region if used.
- Wallet address.
- Created time and confirmation status.
- Solana signature and Explorer link.
- `Verify receipt` button.

#### Receipt verification
Verification occurs inside My Reservations; do not build a separate fourth feature or public verification page.

Checks:
- transaction exists on Solana devnet;
- the stored reservation wallet (`Reservation.wallet`) signed;
- Memo has the correct reservation ID;
- Memo hash equals SHA-256 of the stored canonical payload;
- transaction is confirmed.

The UI status is one of:
- Pending signature
- Confirming
- Verified on Solana
- Signature rejected
- Verification failed

The stored API status remains `pending`, `confirmed`, or `failed`. Confirming and Signature rejected come from the frontend signing flow.
An RPC error means verification is unavailable; it does not prove that a receipt failed a check.
The API and frontend checks that establish each result are specified in section 8.

---

## 6. Scope control

### Must ship
- Explore table, filters, summary cards, and one trend chart.
- Match form, deterministic ranking, explanations, and exclusion summary.
- Phantom devnet connection and memo transaction.
- My Reservations list with receipt verification.
- Databricks bronze/silver/gold pipeline and a live app query to at least one gold output.
- Honest fixtures for Vast and Databricks failures.
- Region comparison chart for the selected GPU, from the gold trend table.

### Should, only after the full flow works at H7
- Performance-per-dollar trend.
- Shareable receipt URL.
- Export reservation receipt as JSON.

### Explicitly cut
- Cost-to-complete or workload benchmark engine.
- ML models, forecasting, or AI chat.
- Playground/burner wallet.
- Deposits, transfers, escrow, tokens, or NFTs.
- Custom Solana program or Anchor.
- Mainnet or real payments.
- Real Vast.ai provisioning.
- Multiple GPU providers.
- User accounts beyond wallet identity.
- Separate Verify tab.
- Mobile optimization.

---

## 7. Architecture

```text
┌──────────────────── Next.js web ────────────────────┐
│ Explore · Match · My Reservations                   │
│ React · TypeScript · Mantine · Recharts             │
└───────────────┬───────────────────────┬─────────────┘
                │ REST                  │ Wallet Adapter + web3.js v1
┌───────────────▼──── Go API ───────────┐  ┌──────────▼───────────┐
│ Vast client and normalization        │  │ Solana devnet        │
│ Deterministic match engine           │  │ Phantom + Memo       │
│ SQLite reservations                  │  └──────────────────────┘
│ Snapshot collector                   │
│ Databricks SQL client + cache        │
└───────────────┬──────────────────────┘
                │ Volume upload + Statement Execution API
┌───────────────▼──── Databricks Free Edition ─────────┐
│ Bronze offers → Silver normalized offers             │
│ → Gold market summaries, trends, market positions    │
│ SQL warehouse + dashboard                            │
└───────────────────────────────────────────────────────┘
```

### Backend stack

The API is a Go service in `/api`. It uses the standard library first.

| Need | Choice |
|---|---|
| HTTP server and routing | `net/http` with Go 1.22 method and path patterns |
| Vast.ai client and JSON | `net/http`, `encoding/json` |
| Databricks SQL | `github.com/databricks/databricks-sdk-go`, Statement Execution API with named parameters |
| Reservations | SQLite through `modernc.org/sqlite` (pure Go, no cgo) |
| Solana transaction checks | `github.com/gagliardetto/solana-go` |
| Receipt hash | `crypto/sha256` |
| Snapshot collector | A goroutine with `time.Ticker` inside the API process |
| CORS | A small middleware that allows the web origin |

Add a dependency only when the standard library does not cover the need.

### Folder ownership

```text
/frontend-digi                        P1
/frontend-digi/lib/solana/**          P3
/frontend-digi/components/solana/**   P3
/frontend-digi/app/solana-lab/**      P3
/api                                  P2
/databricks                           P4
/fixtures                             P2 owns; P4 adds Databricks exports
/docs/demo.md                         P4
```

P1 may place P3’s exported components but does not edit their internals.

### Environment variables

```text
# api/.env — never commit values
VAST_API_KEY=...
USE_VAST_FIXTURE=0
DATABRICKS_HOST=...
DATABRICKS_TOKEN=...
DATABRICKS_SQL_WAREHOUSE_ID=...
USE_DATABRICKS_FIXTURE=0

# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

The Databricks and Vast tokens remain server-side.

---

## 8. Frozen contract

```ts
export type Offer = {
  id: string;
  gpu_name: string;
  num_gpus: number;
  gpu_ram_gb: number;
  total_vram_gb: number;
  region: string;
  price_per_hour: number;
  reliability: number;
  dlperf: number | null;
  performance_per_dollar: number | null;
  verified: boolean;
  market_position_pct: number | null;
  price_percentile: number | null;
};

export type MarketSummary = {
  gpu_name: string;
  listing_count: number;
  lowest_price: number;
  median_price: number;
  p90_price: number;
  median_reliability: number;
  updated_at: string;
};

export type TrendPoint = {
  timestamp: string;
  minimum_price: number;
  median_price: number;
  p10_price: number;
  p90_price: number;
  listing_count: number;
};

export type MatchRequest = {
  min_vram_gb: number;
  max_price_per_hour: number;
  min_reliability: number;
  priority: "cheapest" | "balanced" | "performance";
  gpu_names?: string[];
  region?: string;
};

export type Recommendation = {
  rank: number;
  offer: Offer;
  score: number;
  score_breakdown: {
    price: number;
    performance: number;
    reliability: number;
  };
  explanations: string[];
};

export type MatchResponse = {
  request_id: string;
  snapshot_id: string;
  checked: number;
  eligible: number;
  excluded: Record<"gpu_model" | "region" | "vram" | "reliability" | "budget", number>;
  recommendations: Recommendation[];
};

export type Reservation = {
  id: string;
  request_id: string;
  snapshot_id: string;
  offer_id: string;
  wallet: string;
  gpu_name: string;
  price_per_hour: number;
  min_vram_gb: number;
  max_price_per_hour: number;
  priority: string;
  region: string | null;
  created_at: string;
  canonical_payload: string;
  payload_hash: string;
  status: "pending" | "confirmed" | "failed";
  signature: string | null;
  slot: number | null;
};
```

### API response contract

The wire formats below describe the implemented Go API. The domain types above keep their existing fields.
Only offers, market summary, and market trends use the data envelope. Health, Match, and reservation endpoints return their own objects or arrays.

```ts
export type ApiSource =
  | "vast-live"
  | "vast-saved"
  | "databricks-live"
  | "databricks-export";

export type ApiEnvelope<T> = {
  source: ApiSource;
  captured_at: string;
  snapshot_id: string | null;
  data: T;
};

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "upstream_unavailable"
  | "internal";

export type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string };
};

export type ComponentStatus = "ok" | "fixture" | "unavailable";

export type HealthResponse = {
  status: "ok" | "degraded";
  components: {
    vast: ComponentStatus;
    databricks: ComponentStatus;
    sqlite: "ok";
  };
  fixtures: { vast: boolean; databricks: boolean };
};

export type CreateReservationRequest = {
  request_id: string;
  snapshot_id: string;
  offer_id: string;
  wallet: string;
  min_vram_gb: number;
  max_price_per_hour: number;
  priority: MatchRequest["priority"];
  region?: string | null;
};

export type ConfirmReservationRequest = { signature: string };

export type ReceiptCheckName =
  | "exists"
  | "signer"
  | "reservation_id"
  | "memo_hash"
  | "confirmed";

export type ConfirmReservationResponse = Reservation & {
  failed_checks: ReceiptCheckName[];
};

export type ReceiptCheck = {
  name: ReceiptCheckName;
  passed: boolean;
  detail: string;
};

export type VerifyReservationResponse = {
  reservation_id: string;
  signature: string;
  slot: number | null;
  checks: ReceiptCheck[];
};
```

### Sources and capture times

| Endpoint family | Allowed source | Frontend label |
|---|---|---|
| Offers | `vast-live` | `Live Vast.ai inventory` |
| Offers | `vast-saved` | `Saved market snapshot from {time}` |
| Market summary and trends | `databricks-live` | `Databricks insights updated at {time}` |
| Market summary and trends | `databricks-export` | `Exported Databricks insights from {time}` |

- `captured_at` is an RFC 3339 UTC data timestamp, never the fetch time or the current browser time.
- Offers use the original snapshot capture time. A cached or saved response retains that time.
- Live summary uses `MarketSummary.updated_at`. Live trends use the last returned point's timestamp.
- A live query with no matching rows uses the newest data time in its gold table. If that time is unavailable, fallback applies.
- Export responses use the file's `exported_at`. The export script sets it to the newest exported snapshot time, not its `generated_at` run time.
- Preserve each summary's `updated_at` and each trend point's `timestamp`; the envelope does not replace them.
- Every envelope includes `snapshot_id`. Offers return a string; live market queries currently return `null`; exports preserve the file's string or `null`.
- Treat snapshot IDs as opaque identifiers. Do not derive timestamps from their spelling.
- `dev-sample`, `unknown`, and `unavailable` are frontend states, not Go envelope source values. Never relabel synthetic examples as real saved data.
- Match and reservation responses have no source envelope. Match's `snapshot_id` alone does not establish live or saved provenance.

### Units and field meaning

| Fields | Unit or meaning |
|---|---|
| `Offer.reliability`, `MarketSummary.median_reliability`, `MatchRequest.min_reliability` | Ratio from 0 to 1. The frontend displays a percentage; 95% is sent as `0.95`. |
| `Offer.gpu_ram_gb` | VRAM per GPU. Normalization rounds Vast's `gpu_ram / 1024` to the nearest whole GB. |
| `Offer.total_vram_gb` | `num_gpus * gpu_ram_gb`. It is not the Match memory eligibility field. |
| `MatchRequest.min_vram_gb` | Minimum VRAM per GPU. The API compares it with `gpu_ram_gb`. |
| `price_per_hour`, `max_price_per_hour`, summary and trend prices | USD per hour. An offer price is the quote for the whole offer, not a per-GPU division. |
| `dlperf` | Vast's per-machine performance value, or `null`. |
| `performance_per_dollar` | `dlperf / price_per_hour`, or `null` when performance is unavailable. |
| `market_position_pct` | Percentage above or below the GPU median: `(price - median) / median * 100`, rounded to two decimals. Negative means below typical. |
| `price_percentile` | Nullable field preserved by the contract. Live normalization does not populate it. |
| `score`, each `score_breakdown` value | Score from 0 to 100. Breakdown values are independent normalized scores, not percentages that sum to 100. |
| `listing_count`, `checked`, `eligible`, `excluded` | Counts of offers, not physical GPUs. |
| `Reservation.min_vram_gb` | The submitted requirement, stored without conversion. Historical payloads do not record a VRAM-rule version. |
| `created_at`, `updated_at`, `timestamp` | UTC data times. Reservation creation time is not a Solana confirmation time. |

### Endpoints

Successful JSON responses have `Content-Type: application/json`.

| Method | Path | HTTP status | Response body |
|---|---|---|---|
| GET | `/api/health` | 200 | `HealthResponse` |
| GET | `/api/offers` | 200 | `ApiEnvelope<Offer[]>` |
| GET | `/api/market/summary?gpu_name=...` | 200 | `ApiEnvelope<MarketSummary \| null>` |
| GET | `/api/market/trends?gpu_name=...&region=...` | 200 | `ApiEnvelope<TrendPoint[]>` |
| POST | `/api/match` | 200 | `MatchResponse` |
| POST | `/api/reservations` | 201 | `Reservation` |
| POST | `/api/reservations/{id}/confirm` | 200 | `ConfirmReservationResponse` |
| GET | `/api/reservations?wallet=...` | 200 | `Reservation[]` |
| GET | `/api/reservations/{id}/verify` | 200 | `VerifyReservationResponse` |

The current API has no GPU Index endpoint. Its gold table and export do not imply an implemented route.
The Databricks client uses named SQL parameters. Never interpolate request values into SQL.

#### Offers and market reads

- `/api/offers` returns normalized inventory without server-side query filters. Explore filters locally; `/api/match` applies the Match requirements.
- Offers use a 60-second cache. A failed refresh serves the last successful in-memory snapshot as `vast-saved` when available.
- If no in-memory snapshot is available, a configured saved Vast file can supply the fallback. If neither source can supply data, return 503.
- `USE_VAST_FIXTURE=1` reads `fixtures/vast_offers.json` without a Vast request. A missing or invalid file makes offers and Match return 503.
- The API computes market position from an available gold median. Without a median it leaves the offer's existing value unchanged; live-normalized offers have `null`.
- Both market endpoints require a nonblank `gpu_name`. Trends use `region=all` when region is omitted or blank, not a mixture of regional rows.
- Live market queries map raw GPU names through `solgpu.silver.gpu_name_map`. Unmapped names retain their input value.
- The current export loader matches canonical names exactly. It has no raw-name map, so differently spelled raw names can lack fallback insights.
- Summary returns the latest row for the GPU. A successful query with no row returns `data: null`, not 404.
- Trends return points in ascending timestamp order. No matching points returns `data: []`, not 404.
- Successful Databricks query results are cached for five minutes. Query errors are not cached as successful results.
- A market query failure falls back to the loaded gold export. With no usable source, return 503 `upstream_unavailable`.
- `USE_DATABRICKS_FIXTURE=1` skips live warehouse queries and uses the export. No response substitutes synthetic development data.

#### Health

- A successful health request returns 200 even when `status` is `degraded`.
- `status` is `degraded` if Vast or Databricks reports `unavailable`; otherwise it is `ok`.
- SQLite failure returns 503 `ApiErrorResponse`, not a `HealthResponse` with a failed SQLite component.
- `fixtures` reports configured fixture flags, not the provenance of another request.
- Vast health uses the last inventory result; it does not make a new Vast request. Fixture mode reports `fixture`.
- Databricks health checks the live median source when configured. A live failure can report `unavailable` even when a market request can use an export.
- Without a live Databricks source, a loaded export reports `fixture`; no source reports `unavailable`.
- Health is not proof that fixture files are valid or that a particular offer or Match response is live. Use each response's metadata where available.

#### Match

- Submit `MatchRequest`. The API validates nonnegative `min_vram_gb`, positive `max_price_per_hour`, ratio reliability, and one of the three priorities.
- The frontend supplies the 95% reliability and Balanced defaults. The API does not apply those UI defaults to omitted fields.
- Each excluded offer counts only against its first failed filter. `checked` equals `eligible` plus the sum of the exclusion counts.
- Recommendations contain up to five eligible offers, with consecutive ranks from 1. No eligible offers returns `recommendations: []` with HTTP 200.
- The API normalizes over all eligible offers. Equal component values score 100; missing `dlperf` gives a performance component of 0.
- Overall scores are rounded to two decimals before ranking. Lower price, higher reliability, and offer ID break equal-score ties.
- Missing Databricks medians do not prevent ranking. The API omits median-price explanations when no median is available.
- `MatchResponse` has no suggestion, source, capture time, or echoed request. Keep the submitted request with its results in the frontend.
- The frontend may use exclusion counts for qualitative advice. It must not invent an eligible budget or VRAM threshold.

#### Reservation creation and listing

- Submit `CreateReservationRequest`. The wallet must parse as a Solana public key; IDs must be nonempty and the snapshot must contain the offer.
- The API retains the last 15 distinct inventory snapshots in memory. A missing or expired snapshot/offer pair returns 400 `bad_request`.
- Request validation requires nonnegative VRAM, positive budget, and an allowed priority. An omitted, null, or empty region is stored as `null`.
- GPU name and quoted price come from the stored snapshot offer, not from caller-supplied price or GPU fields.
- Creation returns a new pending reservation with the exact canonical payload, its hash, and `signature: null`, `slot: null`.
- Creation has no idempotency key. Repeating it can create another reservation; do not automatically retry this POST.
- The create handler does not rerun Match eligibility or authenticate wallet ownership. A reservation is not a GPU booking.
- Listing requires a nonblank wallet query. It returns a plain array ordered by `created_at` descending, then ID descending; an empty list is `[]`.
- Listing by a public address is not authentication. The API has no user session or private-account access control.

#### Reservation confirmation and verification

- Submit `ConfirmReservationRequest` with a valid Solana transaction signature. A nonexistent reservation returns 404.
- A confirmed record with the same signature returns its stored reservation and `failed_checks: []` without another RPC check.
- A different signature for a record that already has one returns 400. The API does not overwrite that receipt.
- RPC checks have a ten-second request timeout. RPC failure returns 503 without marking a pending record failed.
- A pending transaction not yet visible on devnet also returns 503 and stays pending. Retry confirmation with the same signature after a delay.
- A found transaction that fails checks changes a pending reservation to `failed` and retains its signature. Passing all checks stores `confirmed`, signature, and slot.
- Confirmation can return HTTP 200 with `status: "failed"` and nonempty `failed_checks`. Check the body; HTTP success alone does not mean verified.
- Failed records stay failed. A repeat confirm can return the reasons; an inconsistent later all-pass RPC result returns 503 rather than promote the record.
- `/verify` uses the stored signature, runs the checks again, and does not change the record. A record without a signature returns 400.
- Verification returns the five check names in the order shown in `ReceiptCheckName`, with `passed` and `detail` for each.
- A missing transaction gives five false checks, `detail: "transaction not found"`, and `slot: null` with HTTP 200. There is no wire-level `not-run` state.
- The signer check compares against `Reservation.wallet`, never the wallet currently connected in the browser.
- The Go verifier accepts Memo v1 or v2 and uses the first instruction with the expected prefix. It does not reject multiple matching memos.
- `memo_hash` compares the memo value with the stored `payload_hash`. `/verify` does not recompute the hash of `canonical_payload`.
- The frontend must hash the exact stored payload bytes separately to establish that the payload still matches its stored hash.
- `confirmed` requires transaction metadata without an error from a confirmed-commitment RPC read. The response contains a slot, not a block-time field.
- Persisted statuses are only `pending`, `confirmed`, and `failed`. Confirming and Signature rejected are frontend flow states, not stored API values.

### Errors and request boundaries

Application handlers return `ApiErrorResponse` with the HTTP status below. An error is not wrapped in a data envelope.

| HTTP status | `error.code` | Meaning |
|---|---|---|
| 400 | `bad_request` | Invalid body, invalid field, missing required query, unusable snapshot, conflicting signature, or receipt without a signature. |
| 404 | `not_found` | Unknown reservation or unmatched endpoint. The current catch-all also returns this for a wrong method on a known path. |
| 503 | `upstream_unavailable` | Inventory, market data, devnet, or the health database check is unavailable; also a transaction not yet visible during confirmation. |
| 500 | `internal` | Internal, storage, or handler recovery error. |

`error.message` is user-facing text. Use `error.code` and HTTP status for logic instead of matching message strings.

| Endpoint | Expected error statuses |
|---|---|
| Health | 503 |
| Offers | 503 |
| Market summary and trends | 400, 503 |
| Match | 400, 503, 500 |
| Create reservation | 400, 500 |
| Confirm reservation | 400, 404, 503, 500 |
| List reservations | 400, 500 |
| Verify reservation | 400, 404, 503, 500 |

Handler recovery can produce 500 on any endpoint. Read-only requests can be retried deliberately; do not automatically replay mutations.
POST handlers limit body reads to 64 KiB and reject unknown JSON object fields. The Go struct decoder supplies zero values for omitted scalar fields.
Send the complete intended request rather than rely on omission as a default.

CORS allows each origin in the comma-separated `ALLOWED_ORIGIN` list, with `GET`, `POST`, and the `Content-Type` request header.
A preflight from a listed origin returns 204 with no JSON body. CORS is not API authentication.

### Canonical reservation payload

The API builds `canonical_payload` once and stores it. The frontend hashes that exact string and never encodes it again.

- Build the payload from a `map[string]any`. `encoding/json` sorts map keys, but it keeps struct fields in declaration order.
- Encode with `json.Marshal`, with no indentation and no extra spaces.
- `payload_hash` is the lowercase hex SHA-256 of the payload bytes.
- The payload contains `id`, `request_id`, `snapshot_id`, `offer_id`, `wallet`, `gpu_name`, `price_per_hour`, `min_vram_gb`, `max_price_per_hour`, `priority`, `region`, and `created_at`.
- Status, signature, and slot are not part of the canonical payload. Later confirmation does not change its bytes.

Memo format accepted by the Go API: `SG1|<reservation_id>|<payload_hash>`.
The frontend signer (`frontend-digi/lib/solana/memo.ts`) uses the same `SG1` prefix.

---

## 9. Databricks implementation

### Collection
- The Go API writes one raw Vast.ai snapshot file every 10 minutes to a shared local directory.
- P4 owns `/databricks/upload_snapshots.py`, which uploads new files to a Unity Catalog Volume and records what succeeded.
- Upload failure does not break Explore or Match; the script retries on the next cycle.
- A scheduled Databricks job runs bronze to silver to gold every 10 minutes, 5 minutes after the collector tick. P4 owns it.
- Start collection and upload by H1 so the demo has real history.

### Bronze
`bronze.vast_offers_raw`
- Append-only.
- Preserve snapshot ID, capture timestamp, and raw provider values.

### Silver
`silver.offers`
- Cast fields to stable types.
- Convert GPU RAM to GB after verifying source units.
- Normalize GPU and region names.
- Deduplicate by `(snapshot_id, offer_id)`.
- Reject rows with missing GPU names, nonpositive prices, or impossible reliability values.

### Gold
- `gold.gpu_market_summary`
- `gold.gpu_price_trends`
- `gold.offer_market_position`

Use SQL window functions for percentiles and ranks. Do not add a model.

### Product connection
The Go API reads gold tables through the Databricks SQL Statement Execution API and caches successful responses for five minutes.

Fallback:
- Export gold results at H7 to `fixtures/databricks_market.json`.
- If the warehouse is unavailable, serve that export with its original timestamp and `source: "databricks-export"`.
- Before judging, wake the SQL warehouse and execute one query.

### What to show Databricks judges
- Raw snapshot rows in bronze.
- Typed, deduplicated rows in silver.
- Price trend and percentile outputs in gold.
- One visible data-quality result, such as invalid rows rejected or duplicate rows removed.
- The same gold result appearing in Explore and Match.

---

## 10. Team execution

| Time | P1 — Frontend | P2 — Backend | P3 — Solana | P4 — Databricks + Pitch |
|---|---|---|---|---|
| H0–0:45 | Scaffold app, nav, frozen types, fixture API client | Go API and SQLite scaffold; test Vast key and fields | Install wallet adapter/web3.js; put Phantom on devnet; obtain test SOL | Create Free Edition workspace, catalog/schema/volume, notebook skeleton |
| H0:45–3 | Explore table, filters, cards, chart on fixtures | `/offers`, normalization, real fixture by H2; collector writing files by H1 | `/solana-lab`: connect Phantom, sign Memo, confirm, open Explorer | Upload script running by H1; ingest first snapshot; bronze/silver/gold tables; initial dashboard |
| **H3 checkpoint** | **Live offers render; Phantom memo confirms; Databricks has a gold summary row** | | | |
| H3–5 | Match form/results/explanations on fixtures | Deterministic `/match`; Databricks SQL client; market endpoints | Reusable wallet and Reserve components; verification helper | Trend and market-position tables; export fixtures; work with P2 on live query |
| **H5 checkpoint** | **Explore receives a real Databricks result and Match returns live offers** | | | |
| H5–7 | My Reservations UI; integrate P3 components; all loading/error states | Reservation create/list/confirm/verify; fixture modes | End-to-end reserve flow against API; rejection and RPC errors | Dashboard polish, pitch script, pull real demo numbers |
| **H7 checkpoint** | **All three tabs work end to end on the driver’s laptop** | | | |
| H7–9 | Visual polish only | Tests and integration fixes | Five reservation tests; fallback signature | Databricks evidence screenshots; Devpost copy; rehearsals |
| **H9 freeze** | **No new features** | **No new features** | **No new features** | **No new features** |
| H9–10:30 | Bug bash and rehearse | Test both fallback modes | Re-fund wallet; verify Explorer links | Direct three rehearsals; record backup video at H10 |
| H10:30–12 | Screenshots | README setup | README Solana section | Submit BNY, Solana, and Databricks entries |

### Unblocking rules
- P1 builds against contract-accurate JSON fixtures immediately.
- P3 builds against a hardcoded reservation on `/solana-lab` before P2 is ready.
- P4 manually uploads P2’s H2 snapshot if automated upload is not ready.
- P2’s market endpoints use the same response shape for live Databricks and exported Databricks data.
- Merge at least every 90 minutes; web and API must remain bootable.

---

## 11. Claude coordination

Place in root `CLAUDE.md`:

- Read PRD §§5, 8, and 9 before coding.
- Do not change frozen API types without team approval.
- Edit only the assigned folders in §7.
- Product navigation contains exactly Explore, Match, and My Reservations.
- Solana uses devnet, Phantom, web3.js v1, Wallet Adapter, and Memo only.
- Databricks performs deterministic analytics; do not introduce ML.
- Never expose API keys or Databricks tokens to the browser.
- No new product features after H7 and no visual redesign after H9.

Give Claude one feature and exact file paths per prompt. Run and inspect the result before merging.

---

## 12. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Vast.ai unavailable or rate-limited | Real H2 fixture labeled with capture time |
| Too little history | Start at H1; show real history collected during the hackathon without exaggerating it |
| Databricks upload/job fails | Manual upload and notebook run; exported gold fixture with honest timestamp |
| SQL warehouse cold-starts | Wake it before judging and cache successful results |
| Phantom is locked or on mainnet | Pre-demo checklist; keep it open on devnet with funded demo wallet |
| Faucet rate-limited | Fund demo wallet with at least 0.1 devnet SOL at H0 and H9 |
| RPC or Explorer unavailable | Known-good signature and backup video |
| Wallet adapter causes Next.js hydration issues | Client component plus dynamic import with SSR disabled; solve first on `/solana-lab` |
| Team adds “winning” features too late | Three-tab rule, H7 integration checkpoint, H9 freeze |

---

## 13. Pre-demo checklist

- [ ] Explore labels live or saved data accurately.
- [ ] Collector has run since H1 and Databricks shows multiple real snapshot times.
- [ ] SQL warehouse is awake; gold query has been tested.
- [ ] Match preset values return at least three eligible offers.
- [ ] Demo explanations contain real Databricks median comparisons.
- [ ] Phantom is unlocked, on devnet, and has at least 0.1 test SOL.
- [ ] A known-good reservation signature is saved locally.
- [ ] Vast fixture and Databricks export modes have both been tested.
- [ ] Databricks dashboard and Solana Explorer are pre-opened.
- [ ] Backup video plays offline.
- [ ] Three rehearsals finish in 5:15 or less.

---

## 14. Judge Q&A

- **What does Databricks do?** “It turns repeated raw marketplace snapshots into price benchmarks, percentiles, and trends. Those results power the cards and chart in Explore and the price explanations in Match.”
- **Why not calculate that directly in the frontend?** “The frontend sees one moment. Databricks cleans and retains thousands of listings across snapshots, resolves data-quality issues, and produces reusable market tables.”
- **Why no machine learning?** “The useful result is transparent market analytics. A model trained on a few hours of data would be less trustworthy, not more.”
- **What does the Solana transaction prove?** “It proves that this wallet signed this reservation intent, including the offer and quoted price, at that time.”
- **Is it a real booking or payment?** “No. It is a devnet reservation-intent prototype. No money or GPU access changes hands.”
- **Why Solana instead of only SQLite?** “A SQLite row can be changed by us. The Solana receipt can be independently checked against the reservation hash.”
- **What comes next?** “More GPU providers, longer price history, price alerts, and provider-side booking after the selection and receipt flow is validated.”

---

## 15. Definition of done at H9

1. Explore displays live Vast.ai inventory and real Databricks market insights.
2. Match deterministically returns and explains suitable offers for VRAM and budget requirements.
3. Phantom signs a reservation-intent Memo on Solana devnet.
4. My Reservations lists the receipt and verifies it against the on-chain transaction.
5. Vast and Databricks fallback modes work and are honestly labeled.
6. The complete three-tab demo runs in 5:15 or less three times.
