package databricks

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const succeeded = `{"statement_id":"s1","status":{"state":"SUCCEEDED"},
"manifest":{"schema":{"column_count":2,"columns":[{"name":"gpu_name","position":0},{"name":"median_price","position":1}]}},
"result":{"data_array":[["RTX 4090","0.48"],["A100",null]]}}`

// newTestClient starts a fake Statement Execution API. The handler gets the decoded body.
func newTestClient(t *testing.T, h func(w http.ResponseWriter, body map[string]any)) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.HasPrefix(r.URL.Path, "/api/2.0/sql/statements") {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		if err := json.Unmarshal(raw, &body); err != nil {
			t.Errorf("body is not json: %v", err)
		}
		h(w, body)
	}))
	t.Cleanup(srv.Close)
	c, err := NewClient(srv.URL, "test-token", "wh1")
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestQuerySuccess(t *testing.T) {
	var got map[string]any
	c := newTestClient(t, func(w http.ResponseWriter, body map[string]any) {
		got = body
		w.Write([]byte(succeeded))
	})
	stmt := "SELECT gpu_name, median_price FROM t WHERE gpu_name = :gpu_name"
	res, err := c.Query(context.Background(), stmt, Param{"gpu_name", "RTX 4090"}, Param{"region", ""})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(res.Columns, ",") != "gpu_name,median_price" || len(res.Rows) != 2 || res.Rows[0][1] != "0.48" {
		t.Fatalf("result = %+v", res)
	}

	if got["statement"] != stmt || got["warehouse_id"] != "wh1" || got["wait_timeout"] != "5s" || got["on_wait_timeout"] != "CANCEL" {
		t.Fatalf("body = %v", got)
	}
	if strings.Contains(got["statement"].(string), "RTX 4090") {
		t.Fatal("a request value is in the statement text")
	}
	params := got["parameters"].([]any)
	if len(params) != 2 {
		t.Fatalf("parameters = %v", params)
	}
	p0 := params[0].(map[string]any)
	if p0["name"] != "gpu_name" || p0["value"] != "RTX 4090" {
		t.Fatalf("parameter 0 = %v", p0)
	}
	if p1 := params[1].(map[string]any); p1["name"] != "region" || p1["value"] != "" {
		t.Fatalf("parameter 1 = %v", p1)
	}
}

func TestQueryErrors(t *testing.T) {
	cases := map[string]func(w http.ResponseWriter){
		"http error status": func(w http.ResponseWriter) {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(`{"error_code":"BAD_REQUEST","message":"bad"}`))
		},
		"failed statement": func(w http.ResponseWriter) {
			w.Write([]byte(`{"status":{"state":"FAILED","error":{"message":"table not found"}}}`))
		},
		"partial result": func(w http.ResponseWriter) {
			w.Write([]byte(`{"status":{"state":"SUCCEEDED"},"manifest":{"truncated":true,"schema":{"columns":[]}}}`))
		},
		"canceled by the wait timeout": func(w http.ResponseWriter) {
			w.Write([]byte(`{"status":{"state":"CANCELED"}}`))
		},
	}
	for name, respond := range cases {
		t.Run(name, func(t *testing.T) {
			c := newTestClient(t, func(w http.ResponseWriter, _ map[string]any) { respond(w) })
			if _, err := c.Query(context.Background(), "SELECT 1"); err == nil {
				t.Fatal("want error")
			}
		})
	}
}

func TestQueryContextTimeout(t *testing.T) {
	release := make(chan struct{})
	c := newTestClient(t, func(w http.ResponseWriter, _ map[string]any) { <-release })
	t.Cleanup(func() { close(release) })
	c.timeout = 50 * time.Millisecond

	start := time.Now()
	if _, err := c.Query(context.Background(), "SELECT 1"); err == nil {
		t.Fatal("want error")
	}
	if time.Since(start) > 5*time.Second {
		t.Fatal("the call did not stop at the timeout")
	}
}
