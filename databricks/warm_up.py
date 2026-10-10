"""Start the SQL warehouse and run one gold query so the first match query does not wait.

Run it right before judging, and again if the warehouse idled more than 10 minutes (prd.md
section 13). It reads DATABRICKS_HOST, DATABRICKS_SQL_WAREHOUSE_ID, and DATABRICKS_TOKEN.
Exit 0 when the warehouse answers, 1 on a failure, 2 when a variable is missing.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

GOLD_QUERY = ("SELECT gpu_name, listing_count, median_price, updated_at "
              "FROM solgpu.gold.gpu_market_summary ORDER BY listing_count DESC LIMIT 5")
FALLBACK_QUERY = "SELECT current_timestamp() AS warehouse_time"
START_LIMIT_S = 600


def api(host, token, method, path, body=None):
    req = urllib.request.Request(host + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode()
    return json.loads(text) if text else {}


def run_query(host, token, wh, sql):
    body = {"warehouse_id": wh, "statement": sql, "wait_timeout": "50s", "on_wait_timeout": "CONTINUE"}
    r = api(host, token, "POST", "/api/2.0/sql/statements", body)
    while r["status"]["state"] in ("PENDING", "RUNNING"):
        time.sleep(5)
        r = api(host, token, "GET", "/api/2.0/sql/statements/" + r["statement_id"])
    return r


def main():
    t0 = time.time()
    for name in ("DATABRICKS_HOST", "DATABRICKS_SQL_WAREHOUSE_ID", "DATABRICKS_TOKEN"):
        if not os.environ.get(name):
            print("missing environment variable: " + name)
            return 2
    host = os.environ["DATABRICKS_HOST"].rstrip("/")
    wh = os.environ["DATABRICKS_SQL_WAREHOUSE_ID"]
    token = os.environ["DATABRICKS_TOKEN"]

    try:
        api(host, token, "POST", "/api/2.0/sql/warehouses/" + wh + "/start")
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        # A warehouse that already runs answers 4xx; that is not a failure.
        if not (400 <= e.code < 500 and "running" in text.lower()):
            print("warehouse start failed: HTTP " + str(e.code) + " " + text[:200])
            return 1
    state = None
    while True:
        new_state = api(host, token, "GET", "/api/2.0/sql/warehouses/" + wh)["state"]
        if new_state != state:
            state = new_state
            print("warehouse state " + state + " at " + str(round(time.time() - t0, 1)) + " s")
        if state == "RUNNING":
            break
        if time.time() - t0 > START_LIMIT_S:
            print("warehouse did not reach RUNNING within " + str(START_LIMIT_S) + " s, last state " + state)
            return 1
        time.sleep(5)

    r = run_query(host, token, wh, GOLD_QUERY)
    if r["status"]["state"] != "SUCCEEDED":
        message = " ".join(r["status"].get("error", {}).get("message", "").split())
        print("gold query failed: " + message[:300])
        if "TABLE_OR_VIEW_NOT_FOUND" not in message:
            return 1
        print("gold table missing: run the pipeline (#116) before the demo")
        r = run_query(host, token, wh, FALLBACK_QUERY)
        if r["status"]["state"] != "SUCCEEDED":
            print("fallback query failed: " + str(r["status"].get("error", {}).get("message", ""))[:300])
            return 1
    cols = [c["name"] for c in r["manifest"]["schema"]["columns"]]
    rows = r["result"].get("data_array") or []
    assert rows, "a SUCCEEDED statement returned no rows"
    print(" | ".join(cols))
    for row in rows:
        print(" | ".join("NULL" if v is None else str(v) for v in row))
    print("warm-up done in " + str(round(time.time() - t0, 1)) + " s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
