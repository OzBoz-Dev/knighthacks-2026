package match

import "github.com/OzBoz-Dev/knighthacks-2026/api/contract"

// Run filters, ranks, and explains the offers for one request. The caller sets RequestID and SnapshotID.
// medians maps gpu_name to the Databricks median price, or is nil when Databricks is unavailable.
// suggestion is empty unless no offer is eligible. The error is only for an unknown priority.
func Run(offers []contract.Offer, req contract.MatchRequest, medians map[string]float64) (resp contract.MatchResponse, suggestion string, err error) {
	eligible, ex := Filter(offers, req)
	recs, err := Rank(eligible, req.Priority)
	if err != nil {
		return contract.MatchResponse{}, "", err
	}
	Explain(recs, eligible, req, medians)
	if len(eligible) == 0 {
		suggestion = Suggest(offers, req, ex)
	}
	return contract.MatchResponse{
		Checked:         len(offers),
		Eligible:        len(eligible),
		Excluded:        ex,
		Recommendations: recs,
	}, suggestion, nil
}
