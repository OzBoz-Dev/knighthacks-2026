// The stored status has only pending, confirmed, and failed. Confirming and Signature rejected come only from
// the live reserve flow (P3), and a fresh verify result can only lower the label, never raise it.
export type FlowState = "awaiting-signature" | "confirming" | "rejected";
export type VerificationOutcome = "passed" | "failed" | "unavailable";
export type StatusTone = "success" | "neutral" | "progress" | "failure";
export type StatusLabel = "Pending signature" | "Confirming" | "Verified on Solana" | "Signature rejected" | "Verification failed" | "Unknown status";

export type StatusView = { label: StatusLabel; tone: StatusTone; note: string };

export function reservationStatus({ status, flow, verification }: { status: string; flow?: FlowState; verification?: VerificationOutcome }): StatusView {
  if (flow === "awaiting-signature") return { label: "Pending signature", tone: "progress", note: "Approve the memo transaction in Phantom." };
  if (flow === "confirming") return { label: "Confirming", tone: "progress", note: "Solana devnet and the solGPU API are checking the transaction." };
  if (flow === "rejected") return { label: "Signature rejected", tone: "failure", note: "You declined the transaction in Phantom. Nothing was signed." };
  if (verification === "failed" && status !== "failed") return { label: "Verification failed", tone: "failure", note: "The latest check of this receipt failed. See the check rows." };
  const unavailable = verification === "unavailable" ? " The latest check could not run, so this shows the stored status." : "";
  switch (status) {
    case "pending":
      return { label: "Pending signature", tone: "neutral", note: `No signed transaction is recorded for this reservation yet.${unavailable}` };
    case "confirmed":
      return { label: "Verified on Solana", tone: "success", note: (verification === "passed" ? "Every check passed just now." : "The solGPU API confirmed this transaction on devnet.") + unavailable };
    case "failed":
      return { label: "Verification failed", tone: "failure", note: `The solGPU API could not verify the transaction for this reservation.${unavailable}` };
    default:
      return { label: "Unknown status", tone: "neutral", note: "The API sent a status that this page does not know." };
  }
}
