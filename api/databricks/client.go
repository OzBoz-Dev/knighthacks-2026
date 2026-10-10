// Package databricks reads the gold market tables through the Statement Execution API.
package databricks

import (
	"context"
	"errors"
	"fmt"
	"time"

	sdk "github.com/databricks/databricks-sdk-go"
	"github.com/databricks/databricks-sdk-go/service/sql"
)

// Param is one named SQL parameter. An empty Value is sent as an empty string.
type Param struct {
	Name  string
	Value string
}

// Result holds the column names and the rows of one statement. Each cell is the
// string that the API returns, or "" for a NULL.
type Result struct {
	Columns []string
	Rows    [][]string
}

// Querier runs one statement with named parameters.
type Querier interface {
	Query(ctx context.Context, statement string, params ...Param) (Result, error)
}

// Client runs statements on one SQL warehouse.
type Client struct {
	api         sql.StatementExecutionInterface
	warehouseID string
	timeout     time.Duration
}

// NewClient builds a client. Tests set host to an httptest server URL.
func NewClient(host, token, warehouseID string) (*Client, error) {
	w, err := sdk.NewWorkspaceClient(&sdk.Config{Host: host, Token: token})
	if err != nil {
		return nil, fmt.Errorf("databricks config: %w", err)
	}
	return &Client{api: w.StatementExecution, warehouseID: warehouseID, timeout: 6 * time.Second}, nil
}

// Query runs the statement. The warehouse cancels it after 5 seconds, and the
// context ends the call after the client timeout.
func (c *Client) Query(ctx context.Context, statement string, params ...Param) (Result, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	req := sql.ExecuteStatementRequest{
		WarehouseId:   c.warehouseID,
		Statement:     statement,
		Format:        sql.FormatJsonArray,
		Disposition:   sql.DispositionInline,
		WaitTimeout:   "5s",
		OnWaitTimeout: sql.ExecuteStatementRequestOnWaitTimeoutCancel,
	}
	for _, p := range params {
		req.Parameters = append(req.Parameters, sql.StatementParameterListItem{
			Name: p.Name, Value: p.Value, Type: "STRING", ForceSendFields: []string{"Value"},
		})
	}

	resp, err := c.api.ExecuteStatement(ctx, req)
	if err != nil {
		return Result{}, fmt.Errorf("databricks statement: %w", err)
	}
	// The server message can quote the statement. That text holds parameter markers, never a value.
	if resp.Status == nil || resp.Status.State != sql.StatementStateSucceeded {
		state, msg := sql.StatementState(""), ""
		if resp.Status != nil {
			state = resp.Status.State
			if resp.Status.Error != nil {
				msg = resp.Status.Error.Message
			}
		}
		return Result{}, fmt.Errorf("databricks statement state %q: %s", state, msg)
	}
	if resp.Manifest == nil || resp.Manifest.Schema == nil {
		return Result{}, errors.New("databricks statement: no result schema")
	}
	if m := resp.Manifest; m.Truncated || m.TotalChunkCount > 1 || (resp.Result != nil && resp.Result.NextChunkIndex > 0) {
		return Result{}, errors.New("databricks statement: the result is partial")
	}
	var res Result
	for _, col := range resp.Manifest.Schema.Columns {
		res.Columns = append(res.Columns, col.Name)
	}
	if resp.Result != nil {
		res.Rows = resp.Result.DataArray
	}
	return res, nil
}
