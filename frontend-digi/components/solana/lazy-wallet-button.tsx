"use client";

import { Skeleton } from "@mantine/core";
import dynamic from "next/dynamic";

// The server can't know the wallet, so the button renders only in the browser. The skeleton keeps the layout still.
export const LazyWalletButton = dynamic(() => import("./wallet-button").then((m) => m.WalletButton), {
  ssr: false,
  loading: () => <Skeleton height={36} width={160} radius="sm" />,
});
