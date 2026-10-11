import { PageHeader } from "@/components/layout/page-header";
import { ReservationList } from "@/components/reservations/reservation-list";

export default function ReservationsPage() {
  return (
    <>
      <PageHeader
        title="My Reservations"
        description="Reservation intents signed with Phantom on Solana devnet, with verifiable on-chain receipts. These are not real bookings or payments."
      />
      <ReservationList />
    </>
  );
}
