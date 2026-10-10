# Vast.ai field notes

Status: every field below is "from the docs, not yet confirmed with a real call".
The network of the author blocked `console.vast.ai`, so nobody has called the API yet.
P2 must confirm each row with the command in the last section. Then P2 removes this status line.

## Endpoint

- `POST https://console.vast.ai/api/v0/bundles/` searches the offers. The body is a JSON query.
- The request header is `Authorization: Bearer <key>`.
- A rentable on-demand query body: `{"rentable":{"eq":true},"type":"on-demand"}`.
- The response body is `{"offers":[ ... ]}`.

## Fields that normalization uses

| Raw field | Meaning | Unit or shape | Maps to `Offer` | Confirmed |
|---|---|---|---|---|
| `id` | Offer ID | Integer. The API writes it as a number. | `id` as a string | From the docs, not yet confirmed with a real call |
| `gpu_name` | GPU model | String, for example `RTX 4090` | `gpu_name` | From the docs, not yet confirmed with a real call |
| `num_gpus` | GPU count in the offer | Integer, 1 or more | `num_gpus` | From the docs, not yet confirmed with a real call |
| `gpu_ram` | VRAM of one GPU | MB (MiB). Vast reports 24564 for a 24 GB card, so round to whole GB after you divide by 1024. | `gpu_ram_gb` | From the docs, not yet confirmed with a real call |
| `dph_total` | Total price of the offer | USD per hour, for all GPUs | `price_per_hour` | From the docs, not yet confirmed with a real call |
| `reliability2` | Machine reliability | Ratio from 0 to 1 | `reliability` | From the docs, not yet confirmed with a real call |
| `reliability` | Older name of the same score | Ratio from 0 to 1. The code uses it when `reliability2` is missing. | `reliability` | From the docs, not yet confirmed with a real call |
| `geolocation` | Machine location | String such as `Texas, US` or `US` | `region` | From the docs, not yet confirmed with a real call |
| `dlperf` | Deep learning score | Number, one score for the whole machine, so not per GPU. Can be missing or null. | `dlperf` | From the docs, not yet confirmed with a real call |
| `verified` | Vast.ai verified host | Boolean | `verified` | From the docs, not yet confirmed with a real call |

## Rules that follow from the table

- `gpu_ram_gb` is `round(gpu_ram / 1024)` to the nearest whole GB. `total_vram_gb` is `num_gpus * gpu_ram_gb`.
- `region` is the last part of `geolocation` after the last comma, trimmed.
- `dlperf` is per machine, so `performance_per_dollar` is `dlperf / dph_total`.
  If the doc check shows that `dlperf` is per GPU, multiply by `num_gpus` first and change the code.
- `dph_total` already covers all GPUs, so the code does not multiply it by `num_gpus`.

## Sample offer (redacted)

P2 fills this with one real offer. Replace the IDs and the host fields with `REDACTED`.

```json
{"PLACEHOLDER": "P2 pastes one redacted offer here"}
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
4. Check that `dlperf`, `num_gpus`, `verified`, and `dph_total` appear as the table says.
5. Check that the response key is `offers`, and that `limit` is a valid query key.
6. Paste the redacted offer in the sample section and fix the table if a row is wrong.
