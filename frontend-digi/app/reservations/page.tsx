import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/shared/async-state";
import { ReservationList } from "@/components/reservations/reservation-list";

export default function ReservationsPage() {
  return (
    <>
      <PageHeader
        title="My Reservations"
        description="Reservation intents signed with Phantom on Solana devnet, with verifiable on-chain receipts. These are not real bookings or payments."
      />
      {/* The list reads ?id= with useSearchParams, so it renders on the client below this boundary. */}
      <Suspense fallback={<LoadingState label="Loading your reservations…" rows={2} />}>
        <ReservationList />
      </Suspense>
    </>
  );
}
