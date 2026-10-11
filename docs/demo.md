# solGPU demo script

Target time: 5:15. Keep 45 seconds in reserve for a delay or a question.
Driver: P4 drives the laptop and speaks. One teammate stands ready to answer judge questions.
Rule: every number in this script comes from the app on screen or from the gold tables. Do not
invent a number (`prd.md` section 4, "Demo rule").

Every value in this script is filled. The table "Numbers to fill in" at the end records the
source and the capture time of each one. Refresh the app values at H9: they change with each
snapshot, and #10 and #181 change the Match result.

## Before you start

- Read the data source label on each screen before you speak. The label is one of:
  `Live Vast.ai inventory`, `Databricks insights updated at {time}`, or
  `Saved market snapshot from {time}`.
- If the label says `Saved market snapshot from {time}`, say so out loud. Never present saved
  data as live.
- A reservation is a signed intent on devnet. It is not a booking and not a payment. Say this
  once in the My Reservations block.
- Confirm the pre-demo checklist in `prd.md` section 13: Phantom is unlocked and on devnet, the
  SQL warehouse is awake, and the Databricks gold table and Solana Explorer are open in tabs.
- Select the demo GPU before the demo: RTX 4090.

## 0:00-0:30 Explore: open

Action:

1. Show the Explore tab with no filter applied.
2. Point at the data source label.

Say:

"The same GPU can have very different prices depending on the host and region. solGPU makes
that market easy to compare. What you see is Live Vast.ai inventory."

## 0:30-1:50 Explore: live inventory and insights

Action:

1. Set the GPU model filter to RTX 4090.
2. Set the minimum VRAM to 24 GB.
3. Set the region filter to US.
4. Set the maximum hourly price to $2/hour.
5. Point at the Lowest, Typical, High, and Listing count cards.
6. Point at the trend chart and its update time.
7. Point at one `Good price` badge in the table.

Say:

"This is Live Vast.ai inventory. We filter to RTX 4090 with 24 GB and
a $2 budget. Right now the lowest price is $0.15/hour, the typical price is $0.54/hour, and the
high end is $0.90/hour across 36 offers. The cards and this trend chart come from Databricks,
updated at 2026-10-10 23:37 UTC. This badge says the offer is 72% below the typical price for
this model. That's a real benchmark, not a guess."

## 1:50-3:15 Match: ranked recommendations

Action:

1. Open the Match tab.
2. Enter 24 GB in the minimum VRAM field.
3. Enter $2/hour in the budget field.
4. Select the Balanced priority. Keep the minimum reliability at the default of 95%.
5. Submit the form.
6. Point at the summary line and the exclusion counts.
7. Read the explanations on the top result, then show the next two results.

Say:

"I need 24 GB of VRAM and I can spend $2 an hour. solGPU checked 64 offers and 46 meet the
requirements. Budget removed 15 and VRAM removed 3. The top option is an RTX 5090 at $0.83/hour:
32 GB per GPU meets the memory requirement, and it has 99.8% reliability. The third option, at
$0.38/hour, is 31% below the typical RTX 5090 price and has the best performance per dollar.
Every explanation is a rule you can read, so the same market and the same request always give
the same order."

## 3:15-3:40 Databricks proof

Action:

1. Expand "How pricing insights are calculated" on the Match results.
2. Switch to the open Databricks tab with the `gold.gpu_market_summary` table or the dashboard.
3. Point at the snapshot count and the latest snapshot time.
4. Switch back to the app.

Say:

"Every point in the chart and every market comparison comes from this snapshot pipeline. We
collect Vast.ai offers every 10 minutes, clean them in Databricks, and publish price benchmarks.
This run holds 8 snapshots and 10226 cleaned offers, and the last snapshot was at
2026-10-10 23:37:28 UTC."

## 3:40-4:50 My Reservations: reserve the top match

Action:

1. Click Reserve on the top match.
2. Connect Phantom. Confirm that Phantom shows devnet.
3. Point at the quoted price and the payload hash on the reservation card.
4. Approve the memo transaction in Phantom.
5. Wait for the status to change to Verified on Solana.
6. Click the Explorer link and show the Memo in the transaction.
7. Return to the My Reservations tab.

Say:

"I'll reserve the top match. I connect Phantom on devnet and click Reserve. The app builds a
reservation intent: this offer at $0.83/hour, and
hashes it. Phantom signs one memo transaction with that hash. To be clear, this is a signed
intent on devnet, not a booking and not a payment. Here's the confirmed receipt, and here's the
same memo on Solana Explorer."

## 4:50-5:15 Receipt verification

Action:

1. Click Verify receipt on the new reservation card.
2. Point at each check as it turns green: transaction exists, signer, reservation ID, hash, and
   confirmation.

Say:

"Verify re-checks the receipt against the chain. The transaction exists, this wallet signed it,
the memo carries this reservation ID, the hash matches the stored payload, and it's confirmed at
the slot and the time you see on the receipt. A screenshot can't prove that. This receipt can."

## 5:15-5:30 Close

Action:

1. Return to the Explore tab.

Say:

"solGPU helps you explore the GPU market, choose with confidence, and preserve what you
selected. Thank you."

## Judge Q&A

Each team member reads these answers once before the demo. Answer in one or two sentences, then
stop. The answers come from `prd.md` section 14, changed to match the built product.

**Q: What does Databricks do?**

A: "It turns repeated raw Vast.ai snapshots into price benchmarks, percentiles, and trends through
bronze, silver, and gold tables. The cards and chart in Explore and the price explanations in Match
read those gold tables through our Go API."

**Q: Why not calculate that directly in the frontend?**

A: "The frontend sees one moment. Databricks keeps every 10 minute snapshot, rejects bad rows,
removes duplicates, and produces reusable gold tables that any screen can read."

**Q: Why no machine learning?**

A: "The useful result is transparent market analytics. A model trained on a few hours of data would
be less trustworthy, not more."

**Q: What does the Solana transaction prove?**

A: "It proves that the reservation wallet signed this reservation intent, including the offer ID
and the quoted price, at that slot and time. The memo holds the SHA-256 of the canonical payload, so
anyone can re-hash the stored reservation and compare."

**Q: Is it a real booking or payment?**

A: "No. It is a reservation intent on Solana devnet. No money and no GPU access change hands."

**Q: Why Solana instead of only SQLite?**

A: "A SQLite row can be changed by us. The Solana receipt can be independently checked against the
reservation hash."

**Q: What comes next?**

A: "More GPU providers, longer price history, price alerts, and provider-side booking after the
selection and receipt flow is validated."

**Q: What happens when Vast.ai or Databricks is down?**

A: "Explore loads the most recent saved snapshot and labels it `Saved market snapshot from {time}`.
If Databricks is down, the table keeps working and the insights hide behind 'Pricing insights
temporarily unavailable'. If the warehouse is down, the API serves the gold export with its
original timestamp and the source `databricks-export`. We never show saved data as live."

**Q: How is the match ranking decided?**

A: "It's deterministic. Hard filters run in order: model, region, VRAM, reliability, budget. Then
price, dlperf, and reliability are each scaled 0 to 100 and weighted by the priority. Ties go to
the lower price, then higher reliability, then offer ID. The same snapshot and request always
return the same order."

## Numbers to fill in

Issue #142 fills the Source and Capture time columns. The gold values come from the snapshot
`20261010T233728Z`, the latest in the gold tables at the time of capture. Refresh them from the
same queries if the pipeline runs again before the demo. The rows that still hold a marker need
the running app with the Vast.ai key in `api/.env`.

| Marker | Value | Source | Capture time |
|---|---|---|---|
| demo GPU model with at least three eligible offers at 24 GB and $2/hour | RTX 4090 | `solgpu.gold.offer_market_position`: three offers at 24 GB and at most $2/hour (ids 54083016, 54464707, 55298856) | 2026-10-10 23:37:28 UTC |
| demo GPU model | RTX 4090 | `solgpu.gold.gpu_market_summary`: 36 listings, the most among 24 GB cards | 2026-10-10 23:37:28 UTC |
| data source label shown on Explore | Live Vast.ai inventory | app: `GET /api/offers` returned `source: vast-live`; `frontend-digi/lib/data/provenance.ts` maps it to this label | 2026-10-11 00:59:52 UTC |
| demo region with the most offers for the demo GPU | US | `solgpu.gold.gpu_price_trends`: region US holds 18 of the 36 RTX 4090 listings | 2026-10-10 23:37:28 UTC |
| Lowest card value | $0.15/hour | `solgpu.gold.gpu_market_summary.lowest_price` = 0.1487 | 2026-10-10 23:37:28 UTC |
| Typical card value | $0.54/hour | `solgpu.gold.gpu_market_summary.median_price` = 0.5389 | 2026-10-10 23:37:28 UTC |
| High card value | $0.90/hour | `solgpu.gold.gpu_market_summary.p90_price` = 0.8961 | 2026-10-10 23:37:28 UTC |
| Listing count card value | 36 | `solgpu.gold.gpu_market_summary.listing_count` | 2026-10-10 23:37:28 UTC |
| Databricks insights update time on Explore | 2026-10-10 23:37 UTC | `solgpu.gold.gpu_market_summary.updated_at` (the app formats the same value) | 2026-10-10 23:37:28 UTC |
| percent below median on the badged offer | 72% | `solgpu.gold.offer_market_position.market_position_pct` = -72.4 for offer 54083016 (RTX 4090, US, $0.15/hour) | 2026-10-10 23:37:28 UTC |
| checked offer count from the Match summary | 64 | app: `POST /api/match` with 24 GB, $2/hour, 95%, balanced: `checked` (64 is the Vast.ai default page; refresh after #10 adds a limit) | 2026-10-11 00:59:52 UTC |
| eligible offer count from the Match summary | 46 | app: `POST /api/match`: `eligible` | 2026-10-11 00:59:52 UTC |
| budget exclusion count | 15 | app: `POST /api/match`: `excluded.budget` | 2026-10-11 00:59:52 UTC |
| VRAM exclusion count | 3 | app: `POST /api/match`: `excluded.vram` | 2026-10-11 00:59:52 UTC |
| GPU model of the top match | RTX 5090 (2 GPUs, 32 GB each, offer 32984232, CA) | app: `POST /api/match`: `recommendations[0].offer` | 2026-10-11 00:59:52 UTC |
| hourly price of the top match | $0.83/hour | app: `POST /api/match`: `recommendations[0].offer.price_per_hour` = 0.8262 | 2026-10-11 00:59:52 UTC |
| percent below the typical price for the third match | 31% | app: `POST /api/match`: `recommendations[2]` explanation "$0.38/hour, 31% below the typical RTX 5090 price" (offer 51027140, SK); the top match is a 2-GPU offer and gets no price comparison once #181 lands | 2026-10-11 00:59:52 UTC |
| reliability of the top match | 99.8% | app: `POST /api/match`: `recommendations[0].offer.reliability` = 0.9983 | 2026-10-11 00:59:52 UTC |
| snapshot count in Databricks | 8 | `solgpu.gold.gpu_price_trends`: `count(DISTINCT timestamp)`, the same as `solgpu.bronze.vast_offers_raw` | 2026-10-10 23:37:28 UTC |
| silver offer row count | 10226 | `solgpu.silver.offers`: `count(*)` across the 8 snapshots | 2026-10-10 23:37:28 UTC |
| latest snapshot time in gold.gpu_market_summary | 2026-10-10 23:37:28 UTC | `solgpu.gold.gpu_market_summary`: `max(updated_at)` | 2026-10-10 23:37:28 UTC |
| quoted hourly price on the reservation card | $0.83/hour | the reservation quotes the top match price, `price_per_hour` = 0.8262 (the card shows the same value) | 2026-10-11 00:59:52 UTC |
| confirmation timestamp on the receipt | read from the receipt during the demo | the reservation is signed live on stage, so the receipt and Solana Explorer show the block time; the script does not fix it in advance | created during the demo |

## Fallback mode test

Issue #166. Run the API with no keys: `USE_VAST_FIXTURE=1 USE_DATABRICKS_FIXTURE=1`. Each
response must carry a saved source and its original time, never the fetch time.

| Check | Result at 2026-10-11T02:15Z |
|---|---|
| `GET /api/health` | `vast: fixture`, `databricks: fixture`, `sqlite: ok` |
| `GET /api/offers` | `source: vast-saved`, `captured_at 2026-10-11T02:15:03Z`, 512 offers from `fixtures/vast_offers.json` |
| `GET /api/market/summary?gpu_name=RTX 4090` | `source: databricks-export`, `captured_at 2026-10-10T23:49:28Z`, median 0.54 |
| `GET /api/market/trends?gpu_name=RTX 4090` | `source: databricks-export`, 9 points from 21:16:05Z to 23:49:28Z |
| `POST /api/match` (24 GB, $2/hour, 95%, balanced) | checked 512, eligible 224; the top result is a 1x RTX 5090 at $0.41/hour, 26% below the typical price |
| API log | no call to Vast.ai or Databricks |

Explore must show `Saved market snapshot from 2026-10-11 02:15 UTC` and the insights panel
`Exported Databricks insights from 2026-10-10 23:49 UTC` in this mode. Refresh both fixture files
at H9: `python databricks/export_fixture.py` for the gold export, and one `GET /api/offers` from
the live API saved as `fixtures/vast_offers.json` with `source` set to `vast-saved`.

## Rehearsal log

Issue #152 fills this table. Three rehearsals must finish in 5:15 or less.

| Run | Time | Problems |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
