package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func envFrom(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadConfigMissingKeys(t *testing.T) {
	cases := []struct {
		name    string
		env     map[string]string
		wantErr []string
	}{
		{"keys missing, fixtures off", map[string]string{}, []string{"VAST_API_KEY", "DATABRICKS_HOST", "DATABRICKS_TOKEN", "DATABRICKS_SQL_WAREHOUSE_ID"}},
		{"keys missing, fixtures on", map[string]string{"USE_VAST_FIXTURE": "1", "USE_DATABRICKS_FIXTURE": "1"}, nil},
		{"vast fixture on only", map[string]string{"USE_VAST_FIXTURE": "1"}, []string{"DATABRICKS_HOST"}},
		{"all keys set", map[string]string{"VAST_API_KEY": "k", "DATABRICKS_HOST": "h", "DATABRICKS_TOKEN": "t", "DATABRICKS_SQL_WAREHOUSE_ID": "w"}, nil},
		{"mainnet rpc", map[string]string{"USE_VAST_FIXTURE": "1", "USE_DATABRICKS_FIXTURE": "1", "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"}, []string{"SOLANA_RPC_URL"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := loadConfig(envFrom(tc.env))
			if tc.wantErr == nil {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil {
				t.Fatal("expected an error")
			}
			for _, want := range tc.wantErr {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not name %s", err, want)
				}
			}
		})
	}
}

func TestLoadConfigNeverPrintsSecrets(t *testing.T) {
	_, err := loadConfig(envFrom(map[string]string{"VAST_API_KEY": "secret-vast", "DATABRICKS_TOKEN": "secret-dbx"}))
	if err == nil || strings.Contains(err.Error(), "secret-") {
		t.Fatalf("error must exist and hold no secret: %v", err)
	}
}

func TestLoadConfigDefaults(t *testing.T) {
	c, err := loadConfig(envFrom(map[string]string{"USE_VAST_FIXTURE": "1", "USE_DATABRICKS_FIXTURE": "1"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != "8000" || !c.UseVastFixture || !c.UseDatabricksFixture || c.SolanaRPCURL != "https://api.devnet.solana.com" {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestLoadDotEnvKeepsShellValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	os.WriteFile(path, []byte("# comment\nDOTENV_A=from-file\nDOTENV_B=\"quoted\"\n\nnot a pair\n"), 0o600)
	t.Setenv("DOTENV_A", "from-shell")
	t.Setenv("DOTENV_B", "")
	os.Unsetenv("DOTENV_B")
	if err := loadDotEnv(path); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("DOTENV_A") != "from-shell" || os.Getenv("DOTENV_B") != "quoted" {
		t.Fatalf("got A=%q B=%q", os.Getenv("DOTENV_A"), os.Getenv("DOTENV_B"))
	}
	if err := loadDotEnv(filepath.Join(t.TempDir(), "missing")); err != nil {
		t.Fatalf("a missing file must not fail: %v", err)
	}
}
