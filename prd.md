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
- `Saved market snapshot from {time}` when using fallback data

Never present fixture data as live.

---

## 5. Feature requirements

### 5.1 Explore

#### Must
- Offers table using normalized Vast.ai data.
- Columns: GPU, GPU count, VRAM per GPU, region, hourly price, reliability, performance score, verified host.
- Filters:
  - GPU model
  - minimum total VRAM
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
- Minimum total VRAM in GB.
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
3. Total VRAM.
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

If no offers qualify, use the exclusion counts to give one useful suggestion, such as “Budget excluded 48 offers; try raising it above $1.20/hour.”

### 5.3 My Reservations

#### Reserve flow
1. User connects Phantom.
2. Backend creates a pending reservation and returns an exact canonical payload and SHA-256 hash.
3. Frontend verifies the hash locally.
4. Phantom signs a Solana devnet transaction containing a Memo:

   ```text
   CX1|<reservation_id>|<payload_hash>
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
- connected wallet signed;
- Memo has the correct reservation ID;
- Memo hash equals SHA-256 of the stored canonical payload;
- transaction is confirmed.

Status is one of:
- Pending signature
- Confirming
- Verified on Solana
- Signature rejected
- Verification failed

---

## 6. Scope control

### Must ship
- Explore table, filters, summary cards, and one trend chart.
- Match form, deterministic ranking, explanations, and exclusion summary.
- Phantom devnet connection and memo transaction.
- My Reservations list with receipt verification.
- Databricks bronze/silver/gold pipeline and a live app query to at least one gold output.
- Honest fixtures for Vast and Databricks failures.

### Should, only after the full flow works at H7
- Region comparison chart.
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

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Vast, Databricks, SQLite, and source status |
| GET | `/api/offers` | live or saved normalized offers |
| GET | `/api/market/summary?gpu_name=...` | Databricks gold summary |
| GET | `/api/market/trends?gpu_name=...&region=...` | Databricks gold trend points |
| POST | `/api/match` | ranked suitable offers |
| POST | `/api/reservations` | create pending intent |
| POST | `/api/reservations/{id}/confirm` | independently verify Solana transaction |
| GET | `/api/reservations?wallet=...` | wallet reservations |
| GET | `/api/reservations/{id}/verify` | rerun on-chain receipt checks |

The Databricks client uses named SQL parameters. Never interpolate request values into SQL.

### Canonical reservation payload

The API builds `canonical_payload` once and stores it. The frontend and the verifier use that exact string and never encode it again.

- Build the payload from a `map[string]any`. `encoding/json` sorts map keys, but it keeps struct fields in declaration order.
- Encode with `json.Marshal`, with no indentation and no extra spaces.
- `payload_hash` is the lowercase hex SHA-256 of the payload bytes.

Memo format: `CX1|<reservation_id>|<payload_hash>`.

---

## 9. Databricks implementation

### Collection
- The Go API writes one raw Vast.ai snapshot file every 10 minutes to a shared local directory.
- P4 owns `/databricks/upload_snapshots.py`, which uploads new files to a Unity Catalog Volume and records what succeeded.
- Upload failure does not break Explore or Match; the script retries on the next cycle.
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
