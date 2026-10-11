"""Export the gold tables to fixtures/databricks_market.json for the API fallback.

Run it at H7 (prd.md section 9, Fallback). The Go API serves the file with the source
databricks-export when the warehouse is unavailable. Every value keeps its own snapshot time:
exported_at is the newest gold snapshot time, not the time this script ran. It reads
DATABRICKS_HOST, DATABRICKS_SQL_WAREHOUSE_ID, and DATABRICKS_TOKEN. Exit 0 on success, 1 on a
query failure, 2 when a variable is missing.
"""
import json
import os
import sys
import time
import urllib.request

OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fixtures", "databricks_market.json")
# Column order follows the frozen types in prd.md section 8; the Go loader reads these names.
SUMMARY_QUERY = ("SELECT gpu_name, listing_count, lowest_price, median_price, p90_price, median_reliability, "
                 "updated_at, snapshot_id FROM solgpu.gold.gpu_market_summary ORDER BY gpu_name")
TRENDS_QUERY = ("SELECT gpu_name, region, `timestamp`, minimum_price, median_price, p10_price, p90_price, "
                "listing_count FROM solgpu.gold.gpu_price_trends ORDER BY gpu_name, region, `timestamp`")
INDEX_QUERY = ("SELECT snapshot_id, captured_at, index_value, basket_size, models_present "
               "FROM solgpu.gold.gpu_price_index ORDER BY captured_at")
# Statement API row limit per call is 16 MiB, far above these tables. Timestamps come back as ISO strings.


def api(host, token, method, path, body=None):
    req = urllib.request.Request(host + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def run_query(host, token, wh, sql):
    body = {"warehouse_id": wh, "statement": sql, "wait_timeout": "50s", "on_wait_timeout": "CONTINUE"}
    r = api(host, token, "POST", "/api/2.0/sql/statements", body)
    while r["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(5)
        r = api(host, token, "GET", "/api/2.0/sql/statements/" + r["statement_id"])
    if r["status"]["state"] != "SUCCEEDED":
        raise RuntimeError("query failed: " + " ".join(r["status"].get("error", {}).get("message", "").split())[:300])
    cols = [c["name"] for c in r["manifest"]["schema"]["columns"]]
    return [dict(zip(cols, row)) for row in (r["result"].get("data_array") or [])]


def rfc3339(value):
    """The API returns 2026-10-10T23:37:28.000Z or 2026-10-10T23:37:28Z; the contract uses whole seconds."""
    return value[:19] + "Z"


def main():
    for name in ("DATABRICKS_HOST", "DATABRICKS_SQL_WAREHOUSE_ID", "DATABRICKS_TOKEN"):
        if not os.environ.get(name):
            print("missing environment variable: " + name)
            return 2
    host = os.environ["DATABRICKS_HOST"].rstrip("/")
    wh = os.environ["DATABRICKS_SQL_WAREHOUSE_ID"]
    token = os.environ["DATABRICKS_TOKEN"]
    try:
        summary_rows = run_query(host, token, wh, SUMMARY_QUERY)
        trend_rows = run_query(host, token, wh, TRENDS_QUERY)
        index_rows = run_query(host, token, wh, INDEX_QUERY)
    except RuntimeError as e:
        print(e)
        return 1
    if not summary_rows:
        print("gold.gpu_market_summary is empty: run the pipeline (#116) first")
        return 1

    summaries = [{"gpu_name": r["gpu_name"], "listing_count": int(r["listing_count"]),
                  "lowest_price": float(r["lowest_price"]), "median_price": float(r["median_price"]),
                  "p90_price": float(r["p90_price"]), "median_reliability": float(r["median_reliability"]),
                  "updated_at": rfc3339(r["updated_at"])} for r in summary_rows]
    trends = [{"gpu_name": r["gpu_name"], "region": r["region"], "timestamp": rfc3339(r["timestamp"]),
               "minimum_price": float(r["minimum_price"]), "median_price": float(r["median_price"]),
               "p10_price": float(r["p10_price"]), "p90_price": float(r["p90_price"]),
               "listing_count": int(r["listing_count"])} for r in trend_rows]
    # index_value stays null when a basket model is missing (databricks/README.md, GPU price index method).
    index = [{"snapshot_id": r["snapshot_id"], "captured_at": rfc3339(r["captured_at"]),
              "index_value": None if r["index_value"] is None else float(r["index_value"]),
              "basket_size": int(r["basket_size"]), "models_present": int(r["models_present"])} for r in index_rows]
    export = {
        "exported_at": max(s["updated_at"] for s in summaries),
        "snapshot_id": max(r["snapshot_id"] for r in summary_rows),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "databricks-export",
        "summaries": summaries,
        "trends": trends,
        "index": index,
    }
    assert all(p["minimum_price"] <= p["p10_price"] <= p["median_price"] <= p["p90_price"] for p in trends)
    assert all((p["index_value"] is None) == (p["models_present"] < p["basket_size"]) for p in index)
    assert export["exported_at"] <= export["generated_at"], "exported_at must be a data time, not the run time"
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(export, f, indent=2)
        f.write("\n")
    snapshots = len({p["timestamp"] for p in trends})
    print("wrote " + os.path.relpath(OUT_PATH) + ": " + str(len(summaries)) + " summaries, " + str(len(trends))
          + " trend points over " + str(snapshots) + " snapshots, " + str(len(index)) + " index points ("
          + str(sum(p["index_value"] is not None for p in index)) + " with a value), exported_at " + export["exported_at"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
