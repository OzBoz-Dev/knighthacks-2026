"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CreateReservationBody } from "../api/reservations";
import type { Reservation } from "../api/types";
import { confirmOnApi, reserve, signAndConfirm, type ReserveDeps, type ReserveState } from "./reserve";

// Runs the reserve flow for one Reserve button. After "Verified on Solana" it opens My Reservations on the receipt.
export function useReserve({ onSettled }: { onSettled?: (state: ReserveState) => void } = {}) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [state, setState] = useState<ReserveState>({ step: "idle" });
  // One flow at a time, so a double click can't create two reservations.
  const busy = useRef(false);

  const run = async (task: (deps: ReserveDeps) => Promise<ReserveState>) => {
    if (busy.current || !publicKey) return;
    busy.current = true;
    try {
      const final = await task({ wallet: publicKey, connection, sendTransaction: (tx) => sendTransaction(tx, connection), onState: setState });
      onSettled?.(final);
      if (final.step === "verified") router.push(`/reservations?id=${encodeURIComponent(final.reservation.id)}`);
    } finally {
      busy.current = false;
    }
  };

  return {
    state,
    reserve: (body: CreateReservationBody) => run((deps) => reserve(body, deps)),
    signAgain: (reservation: Reservation) => run((deps) => signAndConfirm(reservation, deps)),
    checkAgain: (reservation: Reservation, signature: string) => run((deps) => confirmOnApi(reservation, signature, deps)),
  };
}
