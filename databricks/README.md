# databricks

Owner: P4, Databricks. Scope label: `databricks`.

This folder holds the Databricks pipeline: the setup SQL, the bronze, silver, and gold notebooks and
tables, the pipeline job, the dashboard export, and the snapshot upload script. See `prd.md`
section 9.

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
