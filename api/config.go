package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
)

// Config holds every API setting. It is read once at start.
type Config struct {
	Port                  string
	AllowedOrigins        []string
	DBPath               string
	SnapshotDir           string
	VastAPIKey            string
	UseVastFixture        bool
	DatabricksHost        string
	DatabricksToken       string
	DatabricksWarehouseID string
	UseDatabricksFixture  bool
	SolanaRPCURL          string
}

// loadConfig reads the settings through getenv. It returns an error that names
// each missing variable. It never puts a secret value in the error.
func loadConfig(getenv func(string) string) (Config, error) {
	get := func(key, fallback string) string {
		if v := strings.TrimSpace(getenv(key)); v != "" {
			return v
		}
		return fallback
	}
	c := Config{
		Port:                  get("PORT", "8000"),
		AllowedOrigins:        splitOrigins(get("ALLOWED_ORIGIN", "http://localhost:3000")),
		DBPath:                get("DB_PATH", "data/digigpu.db"),
		SnapshotDir:           get("SNAPSHOT_DIR", "data/snapshots"),
		VastAPIKey:            get("VAST_API_KEY", ""),
		UseVastFixture:        get("USE_VAST_FIXTURE", "0") == "1",
		DatabricksHost:        get("DATABRICKS_HOST", ""),
		DatabricksToken:       get("DATABRICKS_TOKEN", ""),
		DatabricksWarehouseID: get("DATABRICKS_SQL_WAREHOUSE_ID", ""),
		UseDatabricksFixture:  get("USE_DATABRICKS_FIXTURE", "0") == "1",
		SolanaRPCURL:          get("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
	}

	var missing []string
	if !c.UseVastFixture && c.VastAPIKey == "" {
		missing = append(missing, "VAST_API_KEY (or set USE_VAST_FIXTURE=1)")
	}
	if !c.UseDatabricksFixture {
		for key, v := range map[string]string{
			"DATABRICKS_HOST":             c.DatabricksHost,
			"DATABRICKS_TOKEN":            c.DatabricksToken,
			"DATABRICKS_SQL_WAREHOUSE_ID": c.DatabricksWarehouseID,
		} {
			if v == "" {
				missing = append(missing, key+" (or set USE_DATABRICKS_FIXTURE=1)")
			}
		}
	}
	if len(missing) > 0 {
		slices.Sort(missing)
		return c, fmt.Errorf("missing required settings: %s", strings.Join(missing, ", "))
	}
	if !strings.Contains(c.SolanaRPCURL, "devnet") {
		return c, errors.New("SOLANA_RPC_URL must be a devnet URL")
	}
	return c, nil
}

// splitOrigins reads a comma-separated origin list. It removes spaces, a trailing slash, and empty items.
func splitOrigins(s string) []string {
	var out []string
	for _, o := range strings.Split(s, ",") {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" {
			out = append(out, o)
		}
	}
	return out
}

// loadDotEnv sets each KEY=VALUE line of path that the environment does not set yet.
// A missing file is not an error, so the API also starts from the shell environment.
func loadDotEnv(path string) error {
	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		key, value, ok := strings.Cut(line, "=")
		if line == "" || strings.HasPrefix(line, "#") || !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if _, set := os.LookupEnv(key); !set {
			os.Setenv(key, strings.Trim(strings.TrimSpace(value), `"'`))
		}
	}
	return s.Err()
}
