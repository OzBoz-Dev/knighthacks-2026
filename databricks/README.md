# databricks

Owner: P4, Databricks. Scope label: `databricks`.

This folder holds the Databricks pipeline: the setup SQL, the bronze, silver, and gold notebooks and
tables, the pipeline job, the dashboard export, and the snapshot upload script. See `prd.md`
section 9.

## Workspace

| Item | Value |
|---|---|
| Edition | Databricks Free Edition |
| Workspace URL | `https://dbc-ee6500ab-419b.cloud.databricks.com` |
| SQL warehouse | `Serverless Starter Warehouse` (serverless, 2X-Small) |
| Catalog | `solgpu`, with the schemas `bronze`, `silver`, and `gold` |
| Raw snapshot volume | `solgpu.bronze.raw_snapshots` |

The Go API and the scripts in this folder read three environment variables: `DATABRICKS_HOST`,
`DATABRICKS_SQL_WAREHOUSE_ID`, and `DATABRICKS_TOKEN`. P4 gives the values to P2 through a private
team channel. This repository holds no token.

The warehouse stops when it is idle. The first statement after a stop takes about 10 seconds.
Run the warm-up step before the demo.

### Snapshot file contract

The Go collector (#11) writes one file for each snapshot. The upload script copies each file to the
volume, and the bronze ingest reads it. One file is one JSON object:

```json
{
  "snapshot_id": "20261010T204000Z",
  "captured_at": "2026-10-10T20:40:00Z",
  "offers": [ { "id": 48857502, "gpu_name": "RTX 4090", "num_gpus": 1, "...": "raw Vast.ai fields" } ]
}
```

- `snapshot_id` is a string that is unique for each capture.
- `captured_at` is the capture time in UTC, RFC 3339.
- `offers` is the raw `offers` array from the Vast.ai response, with no change.
- The file name is `snapshot_<captured_at as 20261010T204000Z>.json`.

## Warm-up before the demo

A cold warehouse can take minutes to start, and the first match query must not wait for it. With
the three environment variables set, run:

```
python databricks/warm_up.py
```

Run it right before judging, and again if the warehouse idled more than 10 minutes. The script
starts the warehouse, prints each warehouse state with the elapsed seconds, runs one query on
`solgpu.gold.gpu_market_summary`, prints the top five rows, and prints the total time as
`warm-up done in 12.4 s`. It exits 1 if the warehouse does not reach RUNNING within 10 minutes.

If the script prints `gold table missing: run the pipeline (#116) before the demo`, the warehouse
runs but gold is empty. Run the pipeline job, then run the warm-up again.

## Offer value score

The gold table `gold.offer_market_position` holds one value score for each offer in the latest
snapshot. The score combines price, performance, and reliability on a 0 to 100 scale. It uses the
same normalization and the same Balanced weights as the Match ranking in `prd.md` section 5.2, so
the two numbers do not contradict each other.

### Inputs

| Input | Unit | Range |
|---|---|---|
| `price_per_hour` | USD per hour | greater than 0. Silver rejects a nonpositive price. |
| `dlperf` | Vast.ai performance number, as Vast.ai reports it | greater than or equal to 0, or null |
| `reliability` | ratio | 0 to 1 |

### Comparison group

The group is all offers with the same canonical `gpu_name` in the same snapshot. This is the group
that `market_position_pct` and `price_percentile` use, so the score reads "value among offers of
this GPU model". Issue #37 leaves the unit of `dlperf` (per GPU or per machine) open. The formula
uses `dlperf` as Vast.ai reports it. A group holds one GPU model, so offers inside a group can still
differ by `num_gpus`.

An offer with a null `dlperf` does not take part in the group minimum, maximum, or count.

### Normalization

Within the group, min-max scale each input to 0 to 100:

```text
price_score       = 100 * (max_price - price_per_hour) / (max_price - min_price)
performance_score = 100 * (dlperf - min_dlperf) / (max_dlperf - min_dlperf)
reliability_score = 100 * (reliability - min_rel) / (max_rel - min_rel)
```

A lower price is better. A higher `dlperf` and a higher `reliability` are better.

Degenerate rule: when the maximum equals the minimum in a group, that component is 100 for every
offer in the group. A flat group has no worse offer.

### Weights and formula

The weights are the Balanced row of the `prd.md` section 5.2 table: 40% price, 35% performance,
25% reliability. Balanced is the default Match priority, so the value score equals the Balanced
Match score for the same group of offers.

```text
value_score = 0.40 * price_score + 0.35 * performance_score + 0.25 * reliability_score
```

Round `value_score` to one decimal. The range is 0 to 100.

### Null rule

- `value_score` is NULL when `dlperf` is NULL. It is not 0.
- `value_score` is NULL when the group has fewer than 2 offers with a non-null `dlperf`. One offer
  has no market to compare with. This matches issue #111: the table gives a null value when the
  model has only one offer.

### Worked example

Example inputs, not market data. Three offers of one GPU model in one snapshot.

| Offer | `price_per_hour` | `dlperf` | `reliability` | `price_score` | `performance_score` | `reliability_score` | `value_score` |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 0.40 | 60.0 | 0.97 | 100.0 | 0.0 | 50.0 | 52.5 |
| B | 0.50 | 80.0 | 0.99 | 50.0 | 100.0 | 100.0 | 80.0 |
| C | 0.60 | 70.0 | 0.95 | 0.0 | 50.0 | 0.0 | 17.5 |

Group ranges: price 0.40 to 0.60, `dlperf` 60.0 to 80.0, `reliability` 0.95 to 0.99.
Offer A: `0.40 * 100 + 0.35 * 0 + 0.25 * 50 = 52.5`.
Offer B: `0.40 * 50 + 0.35 * 100 + 0.25 * 100 = 80.0`.
Offer C: `0.40 * 0 + 0.35 * 50 + 0.25 * 0 = 17.5`.

### References

The SQL in `databricks/sql/32_gold_offer_market_position.sql` (issue #111) implements this formula.
The dashboard and the PRD link to this section.

Open for P2 review: confirm this does not contradict `/api/match` (issue #12).

## GPU price index method (for team review in #29)

Proposed. The team decides in #29 whether to keep the index. Until Databricks calculates it,
Explore must not show it as a live benchmark.

### Basket

The basket is a fixed list of canonical GPU model names with equal weight. It is the basket
Explore shows today: `frontend-digi/lib/explore/selectors.ts` takes every model with a single-GPU
offer in the sample snapshot, so the sample basket is the eight models in
`frontend-digi/lib/data/dev-fixtures.ts`:

`A100 PCIe`, `A40`, `H100 SXM`, `L40S`, `RTX 3090`, `RTX 4090`, `RTX A6000`, `V100`

Risk: `V100`, `A40`, and `RTX A6000` can be rare as single-GPU offers on Vast.ai. Keep them for the
review. A missing model gives a null point, as the rule below says. The basket is a constant in
the SQL, a `VALUES` list. A pull request changes it. The SQL never derives it from the data.

### Input

For each snapshot and each basket model, the model median is the median `price_per_hour` over
`silver.offers` rows where `gpu_name` equals the canonical model and `num_gpus = 1`. Single-GPU
offers only, so a multi-GPU machine price does not skew the model median. This is the same median
that the `gold.gpu_price_trends` row with `region = 'all'` gives if that table is restricted to
`num_gpus = 1`. If the trends table is not restricted that way, the index computes its own median
from silver. Issue #155 must check this dependency before it reads from the trends table.

### Formula

```text
model_median   = median(price_per_hour) over single-GPU offers of one basket model in one snapshot
basket_size    = number of models in the basket constant
models_present = number of basket models with at least one single-GPU offer in the snapshot
index_value    = AVG(model_median) over the basket models, only when models_present = basket_size
```

The unit of `index_value` is USD per hour. One row per `snapshot_id` and `captured_at`.

### Missing-model rule

If any basket model has no single-GPU offer in a snapshot, `index_value` is NULL for that snapshot.
The row still exists with `models_present < basket_size`, so the chart shows a gap, not a different
basket and not a carried-forward value. Never substitute a multi-GPU price, a previous snapshot, or
a smaller basket.

### Minimum listing rule (proposal)

Proposal: `models_present` counts a model only if it has at least 3 single-GPU offers in the
snapshot. One outlier offer then does not move the index. The team accepts or rejects this rule in
#29. Without it, one offer sets the model median.

### Determinism

The same silver snapshot in gives the same index out. The SQL uses `PERCENTILE_CONT(0.5) WITHIN
GROUP (ORDER BY price_per_hour)`. It interpolates between the two middle values for an even count,
the same as the browser `median` helper, and it is deterministic for a fixed input.

### What the app would show

The source label is `Databricks insights updated at {captured_at}`. The index tooltip names the
basket and says "equal-weight mean of median single-GPU hourly prices".

### Worked example

Example inputs, not market data. A 3-model basket: `H100 SXM`, `RTX 4090`, `L40S`.

| Snapshot | `H100 SXM` median | `RTX 4090` median | `L40S` median | `models_present` | `index_value` |
|---|---:|---:|---:|---:|---:|
| 1 | 2.00 | 0.86 | 1.29 | 3 of 3 | 1.3833 |
| 2 | 2.00 | 0.86 | no single-GPU offer | 2 of 3 | NULL |

Snapshot 1: `(2.00 + 0.86 + 1.29) / 3 = 4.15 / 3 = 1.3833`. Snapshot 2: the row exists, the value
is NULL, the basket stays at 3 models.

### Cost if kept, cost if removed

- Kept: the #155 SQL for `gold.gpu_price_index` (small, on top of silver), an API endpoint (P2), a
  `prd.md` section 3 entry, and the insights panel text (#200).
- Removed: delete the index readout from `frontend-digi/components/explore/` (#201).

The recommendation is in the #29 comment, not here.
