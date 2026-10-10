import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/async-state";

export default function ReservationsPage() {
  return (
    <>
      <PageHeader
        title="My Reservations"
        description="Reservation intents signed with Phantom on Solana devnet, with verifiable on-chain receipts. These are not real bookings or payments."
      />
      <EmptyState
        title="Reservations not built yet"
        description="Wallet connection, reservation receipts, and receipt verification will appear here once the Solana devnet integration is in place."
      />
    </>
  );
}
