# fixtures

Owner: P2, backend. P4 adds the Databricks exports. Scope label: `fixtures`.

This folder holds the contract-accurate JSON fixtures: the saved Vast.ai snapshot and the gold
export `databricks_market.json`. Each fixture keeps its original capture time. The app labels
fixture data as saved data, never as live data. See `prd.md` sections 8 and 9.

`vast_offers.json` is a saved snapshot of 64 public Vast.ai offers, captured without an API key and
normalized by `api/vast.Normalize`. `USE_VAST_FIXTURE=1` reads it. Its source is `vast-saved`.
