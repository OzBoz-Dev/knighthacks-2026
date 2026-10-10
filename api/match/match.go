package match

import "github.com/OzBoz-Dev/knighthacks-2026/api/contract"

// Run filters and ranks the offers for one request. The caller sets RequestID and SnapshotID.
// It returns an error only for an unknown priority.
func Run(offers []contract.Offer, req contract.MatchRequest) (contract.MatchResponse, error) {
	eligible, ex := Filter(offers, req)
	recs, err := Rank(eligible, req.Priority)
	if err != nil {
		return contract.MatchResponse{}, err
	}
	return contract.MatchResponse{
		Checked:         len(offers),
		Eligible:        len(eligible),
		Excluded:        ex,
		Recommendations: recs,
	}, nil
}
