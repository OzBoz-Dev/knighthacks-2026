package vast

import "time"

// SnapshotID returns snap_<UTC time as 20060102T150405Z> for the capture time.
func SnapshotID(t time.Time) string { return "snap_" + t.UTC().Format("20060102T150405Z") }
