"""Upload new snapshot files from the collector directory to the raw_snapshots volume.

It reads DATABRICKS_HOST, DATABRICKS_TOKEN, and SNAPSHOT_DIR (required), and SNAPSHOT_VOLUME_PATH
and UPLOAD_MANIFEST (optional). A local manifest lists each uploaded file, so a failed file uploads
again on the next run. Run every 10 minutes, see README. Exit 0 when every file is uploaded, 1 when
a file failed, 2 when a variable is missing.
"""
import datetime
import json
import os
import sys
import urllib.request

DEFAULT_VOLUME_PATH = "/Volumes/solgpu/bronze/raw_snapshots"


def api(host, token, method, path, data=None, content_type="application/json"):
    req = urllib.request.Request(host + path, method=method, data=data,
                                 headers={"Authorization": "Bearer " + token, "Content-Type": content_type})
    with urllib.request.urlopen(req, timeout=300) as r:
        text = r.read().decode()
    return json.loads(text) if text else {}


def write_manifest(path, manifest):
    # Write to a temp file, then replace, so a crash never leaves a half-written manifest.
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
    os.replace(tmp, path)


def main():
    for name in ("DATABRICKS_HOST", "DATABRICKS_TOKEN", "SNAPSHOT_DIR"):
        if not os.environ.get(name):
            print("missing environment variable: " + name)
            return 2
    host = os.environ["DATABRICKS_HOST"].rstrip("/")
    token = os.environ["DATABRICKS_TOKEN"]
    snapshot_dir = os.environ["SNAPSHOT_DIR"]
    if not os.path.isdir(snapshot_dir):
        print("SNAPSHOT_DIR is not a directory: " + snapshot_dir)
        return 2
    volume_path = os.environ.get("SNAPSHOT_VOLUME_PATH", DEFAULT_VOLUME_PATH).rstrip("/")
    manifest_path = os.environ.get("UPLOAD_MANIFEST", os.path.join(snapshot_dir, ".uploaded.json"))

    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)

    # The collector writes to a *.tmp file and renames it, so only the final names match here.
    files = sorted(n for n in os.listdir(snapshot_dir)
                   if n.startswith("snapshot_") and n.endswith(".json"))
    uploaded = skipped = failed = 0
    for name in files:
        if name in manifest:
            skipped += 1
            continue
        try:
            with open(os.path.join(snapshot_dir, name), "rb") as f:
                data = f.read()
            api(host, token, "PUT", "/api/2.0/fs/files" + volume_path + "/" + name + "?overwrite=true",
                data, "application/octet-stream")
            manifest[name] = {"uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                              "bytes": len(data)}
            write_manifest(manifest_path, manifest)
            uploaded += 1
            print("uploaded " + name + " (" + str(len(data)) + " bytes)")
        except Exception as e:
            failed += 1
            print("failed " + name + ": " + str(e))

    verified = True
    if manifest:
        try:
            listing = api(host, token, "GET", "/api/2.0/fs/directories" + volume_path)
            in_volume = {c["name"] for c in listing.get("contents", [])}
            missing = sorted(set(manifest) - in_volume)
            assert not missing, "manifest lists files that are not in the volume: " + ", ".join(missing)
            print("verified " + str(len(manifest)) + " files in volume")
        except Exception as e:
            verified = False
            print("verify failed: " + str(e))
    print("uploaded=" + str(uploaded) + " skipped=" + str(skipped) + " failed=" + str(failed))
    return 0 if failed == 0 and verified else 1


if __name__ == "__main__":
    sys.exit(main())
