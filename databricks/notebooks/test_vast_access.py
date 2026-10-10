# Databricks notebook source
# Issue #62: does serverless notebook compute in Free Edition reach console.vast.ai?
# The public bundles endpoint needs no key, so this notebook reads no secret.
import json, time, urllib.error, urllib.parse, urllib.request

QUERY = {"rentable": {"eq": True}, "type": "on-demand", "gpu_name": {"eq": "RTX 4090"},
         "num_gpus": {"eq": 1}, "order": [["dph_total", "asc"]], "limit": 5}
URL = "https://console.vast.ai/api/v0/bundles/?q=" + urllib.parse.quote(json.dumps(QUERY))

# COMMAND ----------
result = {"allowed": False, "status": None, "offers": 0, "seconds": None, "error": None}
start = time.monotonic()
try:
    with urllib.request.urlopen(URL, timeout=30) as resp:
        status, offers = resp.status, json.load(resp)["offers"]
    result.update(allowed=True, status=status, offers=len(offers))
    print(f"allowed: HTTP {status}, {len(offers)} offers")
    for o in offers:
        print(o["id"], o["gpu_name"], o["num_gpus"], o["dph_total"], o["geolocation"])
    assert all(o["gpu_name"] == "RTX 4090" for o in offers), "the filter did not apply"
except urllib.error.HTTPError as e:
    result.update(status=e.code, error=f"{type(e).__name__}: {e}")
    print("blocked:", result["error"])
except Exception as e:
    result.update(error=f"{type(e).__name__}: {e}")
    print("blocked:", result["error"])
result["seconds"] = round(time.monotonic() - start, 2)

# COMMAND ----------
dbutils.notebook.exit(json.dumps(result))
