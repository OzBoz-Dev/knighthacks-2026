package contract

import (
	"encoding/json"
	"os"
	"regexp"
	"slices"
	"testing"
)

// tsFields reads the top-level field names of each exported type in types.ts.
func tsFields(t *testing.T) map[string][]string {
	src, err := os.ReadFile("../../frontend-digi/lib/api/types.ts")
	if err != nil {
		t.Fatal(err)
	}
	types := map[string][]string{}
	block := regexp.MustCompile(`(?ms)^export type (\w+) = \{\n(.*?)^\};`)
	field := regexp.MustCompile(`(?m)^  (\w+)\??:`)
	for _, m := range block.FindAllStringSubmatch(string(src), -1) {
		for _, f := range field.FindAllStringSubmatch(m[2], -1) {
			types[m[1]] = append(types[m[1]], f[1])
		}
	}
	return types
}

func jsonKeys(t *testing.T, v any) []string {
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func TestStructKeysMatchTypeScript(t *testing.T) {
	ts := tsFields(t)
	region := "US"
	// The optional MatchRequest fields are set so omitempty keeps them.
	goTypes := map[string]any{
		"Offer":          Offer{},
		"MarketSummary":  MarketSummary{},
		"TrendPoint":     TrendPoint{},
		"MatchRequest":   MatchRequest{GPUNames: []string{"RTX 4090"}, Region: region},
		"Recommendation": Recommendation{},
		"MatchResponse":  MatchResponse{},
		"Reservation":    Reservation{},
	}
	for name, v := range goTypes {
		want, ok := ts[name]
		if !ok {
			t.Errorf("types.ts has no type %s", name)
			continue
		}
		got := jsonKeys(t, v)
		slices.Sort(got)
		slices.Sort(want)
		if !slices.Equal(got, want) {
			t.Errorf("%s keys\n go: %v\n ts: %v", name, got, want)
		}
	}
	if len(ts) != len(goTypes) {
		t.Errorf("types.ts has %d types, the test checks %d", len(ts), len(goTypes))
	}
}

func TestNestedKeys(t *testing.T) {
	if got := jsonKeys(t, ScoreBreakdown{}); len(got) != 3 {
		t.Errorf("score_breakdown keys = %v", got)
	}
	got := jsonKeys(t, Excluded{})
	slices.Sort(got)
	if want := []string{"budget", "gpu_model", "region", "reliability", "vram"}; !slices.Equal(got, want) {
		t.Errorf("excluded keys = %v", got)
	}
}

func TestNullableFieldsMarshalNull(t *testing.T) {
	b, _ := json.Marshal(Offer{})
	for _, k := range []string{`"dlperf":null`, `"performance_per_dollar":null`, `"market_position_pct":null`, `"price_percentile":null`} {
		if !regexp.MustCompile(regexp.QuoteMeta(k)).Match(b) {
			t.Errorf("offer JSON lacks %s: %s", k, b)
		}
	}
}
