import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "./globals.css";
import { Providers } from "./providers";
import { AppShellLayout } from "@/components/layout/app-shell";
import { palette } from "@/palette";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "digiGPU",
  description:
    "Explore live GPU marketplace prices, find offers that fit your requirements, and keep verifiable reservation-intent receipts on Solana devnet.",
  other: { "darkreader-lock": "true" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: palette.background,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      {...mantineHtmlProps}
      data-mantine-color-scheme="dark"
      className={`${dmSans.variable} ${dmMono.variable}`}
    >
      <head>
        <ColorSchemeScript forceColorScheme="dark" />
      </head>
      <body>
        <Providers>
          <AppShellLayout>{children}</AppShellLayout>
        </Providers>
      </body>
    </html>
  );
}
