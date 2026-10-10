# solGPU demo script

Target time: 5:15. Keep 45 seconds in reserve for a delay or a question.
Driver: P4 drives the laptop and speaks. One teammate stands ready to answer judge questions.
Rule: every number in this script comes from the app on screen or from the gold tables. Do not
invent a number (`prd.md` section 4, "Demo rule").

Each `{{NUMBER: ...}}` marker holds the place of one real value. Fill every marker before the
first rehearsal. The table "Numbers to fill in" at the end lists them.

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
- Select the demo GPU before the demo: {{NUMBER: demo GPU model with at least three eligible offers at 24 GB and $2/hour}}.

## 0:00-0:30 Explore: open

Action:

1. Show the Explore tab with no filter applied.
2. Point at the data source label.

Say:

"The same GPU can have very different prices depending on the host and region. solGPU makes
that market easy to compare. What you see is {{NUMBER: data source label shown on Explore}}."

## 0:30-1:50 Explore: live inventory and insights

Action:

1. Set the GPU model filter to {{NUMBER: demo GPU model}}.
2. Set the minimum VRAM to 24 GB.
3. Set the region filter to {{NUMBER: demo region with the most offers for the demo GPU}}.
4. Set the maximum hourly price to $2/hour.
5. Point at the Lowest, Typical, High, and Listing count cards.
6. Point at the trend chart and its update time.
7. Point at one `Good price` badge in the table.

Say:

"This is {{NUMBER: data source label shown on Explore}}. We filter to {{NUMBER: demo GPU model}}
with 24 GB and a $2 budget. Right now the lowest price is {{NUMBER: Lowest card value}}, the
typical price is {{NUMBER: Typical card value}}, and the high end is {{NUMBER: High card value}}
across {{NUMBER: Listing count card value}} offers. The cards and this trend chart come from
Databricks, updated at {{NUMBER: Databricks insights update time on Explore}}. This badge says
the offer is {{NUMBER: percent below median on the badged offer}} below the typical price for
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

"I need 24 GB of VRAM and I can spend $2 an hour. solGPU checked
{{NUMBER: checked offer count from the Match summary}} offers and
{{NUMBER: eligible offer count from the Match summary}} meet the requirements. Budget removed {{NUMBER: budget exclusion count}} and VRAM removed
{{NUMBER: VRAM exclusion count}}. The top option is a {{NUMBER: GPU model of the top match}} at
{{NUMBER: hourly price of the top match}}. It meets the memory requirement, it's
{{NUMBER: percent below the typical price for the top match}} below the typical price for this
model, and it has {{NUMBER: reliability of the top match}} reliability. Every explanation is a
rule you can read, so the same market and the same request always give the same order."

## 3:15-3:40 Databricks proof

Action:

1. Expand "How pricing insights are calculated" on the Match results.
2. Switch to the open Databricks tab with the `gold.gpu_market_summary` table or the dashboard.
3. Point at the snapshot count and the latest snapshot time.
4. Switch back to the app.

Say:

"Every point in the chart and every market comparison comes from this snapshot pipeline. We
collect Vast.ai offers every 10 minutes, clean them in Databricks, and publish price benchmarks.
This run holds {{NUMBER: snapshot count in Databricks}} snapshots and
{{NUMBER: silver offer row count}} cleaned offers, and the last snapshot was at
{{NUMBER: latest snapshot time in gold.gpu_market_summary}}."

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
reservation intent: this offer at {{NUMBER: quoted hourly price on the reservation card}}, and
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
{{NUMBER: confirmation timestamp on the receipt}}. A screenshot can't prove that. This receipt
can."

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

Issue #142 fills the Source and Capture time columns.

| Marker | Source | Capture time |
|---|---|---|
| demo GPU model with at least three eligible offers at 24 GB and $2/hour | | |
| demo GPU model | | |
| data source label shown on Explore | | |
| demo region with the most offers for the demo GPU | | |
| Lowest card value | | |
| Typical card value | | |
| High card value | | |
| Listing count card value | | |
| Databricks insights update time on Explore | | |
| percent below median on the badged offer | | |
| checked offer count from the Match summary | | |
| eligible offer count from the Match summary | | |
| budget exclusion count | | |
| VRAM exclusion count | | |
| GPU model of the top match | | |
| hourly price of the top match | | |
| percent below the typical price for the top match | | |
| reliability of the top match | | |
| snapshot count in Databricks | | |
| silver offer row count | | |
| latest snapshot time in gold.gpu_market_summary | | |
| quoted hourly price on the reservation card | | |
| confirmation timestamp on the receipt | | |

## Rehearsal log

Issue #152 fills this table. Three rehearsals must finish in 5:15 or less.

| Run | Time | Problems |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
