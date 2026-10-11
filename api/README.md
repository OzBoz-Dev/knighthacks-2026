# solGPU API

The Go API for solGPU. P2, backend, owns this folder.

`prd.md` section 7, Backend stack, names the libraries. The root `README.md` explains how to
start the API and the frontend from a clean clone.

## Snapshot collector

The API process runs the collector (`collector/`). At start and every 10 minutes it writes one
raw Vast.ai snapshot file to `SNAPSHOT_DIR` (default `data/snapshots`, relative to `api/`). The
file name is `snapshot_<UTC time>.json` and holds `snapshot_id`, `captured_at`, and the raw
`offers` array (contract in `databricks/README.md`, "Snapshot file contract"). A failed Vast.ai
call writes no file and logs one warning; Explore and Match keep working.

Run it on one machine that stays awake (#139, #56):

1. `cd api`, copy `.env.example` to `.env`, set `VAST_API_KEY` and the three `DATABRICKS_*` values.
2. `go run .` and leave the terminal open. The log prints one line for each snapshot file.
3. In a second terminal, run the upload every 10 minutes
   (`databricks/README.md`, "Snapshot upload"): set `SNAPSHOT_DIR` to the same folder and loop
   `python databricks/upload_snapshots.py`.

Machine: the lead's laptop until the team names another one in #56. Disable sleep while it runs.
Stop with Ctrl+C in both terminals; the next start resumes, and the upload manifest skips the
files that are already in the volume.
