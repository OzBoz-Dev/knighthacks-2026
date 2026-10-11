# Vast.ai field notes

Status: P4 confirmed every field below with 2407 real offers in `solgpu.bronze.vast_offers_raw`,
from two snapshots at 2026-10-10T21:16Z (#72). `databricks/README.md` section "Vast.ai field units"
has the counts and ranges. The sample offer below is one real offer from the authenticated
endpoint, captured at 2026-10-11T02:06Z (#94). Its values agree with the table.

## Endpoint

- `POST https://console.vast.ai/api/v0/bundles/` searches the offers. The body is a JSON query.
- The request header is `Authorization: Bearer <key>`.
- A rentable on-demand query body: `{"rentable":{"eq":true},"type":"on-demand"}`.
- The response body is `{"offers":[ ... ]}`.

## Fields that normalization uses

| Raw field | Meaning | Unit or shape | Maps to `Offer` | Confirmed |
|---|---|---|---|---|
| `id` | Offer ID | Integer. The API writes it as a number. | `id` as a string | Bronze, 2407 rows (#72) |
| `gpu_name` | GPU model | String, for example `RTX 4090` | `gpu_name` | Bronze, 2407 rows (#72) |
| `num_gpus` | GPU count in the offer | Integer, 1 or more | `num_gpus` | Bronze, 2407 rows (#72) |
| `gpu_ram` | VRAM of one GPU | MB (MiB). Vast reports 24564 for a 24 GB card, so round to whole GB after you divide by 1024. | `gpu_ram_gb` | Bronze, 2407 rows (#72) |
| `dph_total` | Total price of the offer | USD per hour, for all GPUs | `price_per_hour` | Bronze, 2407 rows (#72) |
| `reliability2` | Machine reliability | Ratio from 0 to 1 | `reliability` | Bronze, 2407 rows (#72) |
| `reliability` | Older name of the same score | Ratio from 0 to 1. The code uses it when `reliability2` is missing. | `reliability` | Bronze, 2407 rows (#72) |
| `geolocation` | Machine location | String `Region, CC`. Every real offer has the two-letter country code after the comma. | `region` | Bronze, 2407 rows (#72) |
| `dlperf` | Deep learning score | Number, one score for the whole machine, so not per GPU. Can be missing or null. | `dlperf` | Bronze, 2407 rows (#72) |
| `verification` | Vast.ai host status | String: `verified`, `unverified`, or `deverified` | `verified` is true only for `verified` | Bronze, 2407 rows (#72) |
| `verified` | Older verified flag | Null in every real offer. The API does not read it. | none | Bronze, 2407 rows (#72) |

## Rules that follow from the table

- `gpu_ram_gb` is `round(gpu_ram / 1024)` to the nearest whole GB. `total_vram_gb` is `num_gpus * gpu_ram_gb`.
- `region` is the last part of `geolocation` after the last comma, trimmed.
- `dlperf` is per machine (#37, #72), so `performance_per_dollar` is `dlperf / dph_total`.
- `dph_total` already covers all GPUs, so the code does not multiply it by `num_gpus`.

## Sample offer (redacted)

Captured 2026-10-11T02:06:03Z from the authenticated endpoint; IDs and host fields are REDACTED.

```json
{
  "id": "REDACTED",
  "gpu_name": "RTX 4090",
  "num_gpus": 1,
  "gpu_ram": 24564,
  "gpu_total_ram": 24564,
  "dph_total": 0.1577,
  "reliability2": 0.9462,
  "reliability": 0.9462,
  "geolocation": "Texas, US",
  "dlperf": 9.999,
  "dlperf_per_dphtotal": 63.401,
  "verification": "deverified",
  "verified": null,
  "rentable": true,
  "rented": false,
  "machine_id": "REDACTED",
  "host_id": "REDACTED",
  "hostname": "REDACTED",
  "public_ipaddr": "REDACTED",
  "cuda_max_good": 13.2,
  "driver_version": "595.58.03"
}
```

## Confirm with a real call (P2)

Run this once with your key. Do not paste the key in the issue or in this file.

```
curl -s -X POST https://console.vast.ai/api/v0/bundles/ \
  -H "Authorization: Bearer $VAST_API_KEY" -H "Content-Type: application/json" \
  -d '{"rentable":{"eq":true},"type":"on-demand","limit":3}' | jq '.offers[0]'
```

Then check each row of the table against the output:

1. Check that `gpu_ram` is in MB (for example 24564 for a 24 GB card).
2. Check which reliability field exists and that its range is 0 to 1.
3. Check the text of `geolocation`.
4. Check that `dlperf`, `num_gpus`, `verification`, and `dph_total` appear as the table says.
5. Check that the response key is `offers`, and that `limit` is a valid query key.
6. Paste the redacted offer in the sample section and fix the table if a row is wrong.
