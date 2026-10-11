"use client";

import { AppShell, Burger, Container, Group, NavLink, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCompass, IconReceipt, IconTarget } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LazyWalletButton } from "@/components/solana/lazy-wallet-button";
import { FadeIn } from "@/components/shared/fade-in";
import { ApiStatus } from "./api-status";

export const NAV_ITEMS = [
  { href: "/", label: "Explore", icon: IconCompass },
  { href: "/match", label: "Match", icon: IconTarget },
  { href: "/reservations", label: "My Reservations", icon: IconReceipt },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure(false);

  return (
    <AppShell
      navbar={{ width: { sm: 212, lg: 224 }, breakpoint: "sm", collapsed: { mobile: !opened } }}
      header={{ height: 56, collapsed: true, offset: false }}
      padding={0}
    >
      <a href="#main-content" className="skip-link">Skip to content</a>
      <AppShell.Navbar bg="dark.8" p="md" aria-label="Sidebar">
        <AppShell.Section pt="xs" pb={36}>
          <Burger hiddenFrom="sm" opened={opened} onClick={close} size="sm" mb="md" aria-label="Close navigation" />
          <FadeIn transition="fade-right">
            <Group renderRoot={(props) => <Link {...props} href="/" onClick={close} />} gap={10} wrap="nowrap" style={{ textDecoration: "none" }}>
              <Image src="/solGPU.png" width={325} height={304} alt="" aria-hidden style={{ width: 33, height: "auto" }} />
              <Text fw={650} fz={20} c="dark.0" lh={1} style={{ letterSpacing: "-0.4px" }}>solGPU</Text>
            </Group>
          </FadeIn>
        </AppShell.Section>
        <AppShell.Section grow component="nav" aria-label="Primary">
          <Stack gap={2}>
            {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
              const active = isActive(pathname, href);
              return (
                <FadeIn key={href} transition="fade-right" delay={60 + index * 40}>
                <NavLink
                  component={Link}
                  href={href}
                  label={label}
                  leftSection={<Icon size={17} stroke={1.6} aria-hidden />}
                  active={active}
                  aria-current={active ? "page" : undefined}
                  onClick={close}
                  color="gray"
                  variant="subtle"
                  py={10}
                  styles={{
                    root: {
                      borderRadius: 2,
                      borderLeft: `2px solid ${active ? "var(--mantine-color-lava-5)" : "transparent"}`,
                      background: active ? "var(--dg-elevated)" : undefined,
                      color: active ? "var(--mantine-color-dark-0)" : "var(--mantine-color-dark-1)",
                    },
                    label: { fontSize: 14, fontWeight: active ? 600 : 450 },
                  }}
                />
                </FadeIn>
              );
            })}
          </Stack>
        </AppShell.Section>
        <AppShell.Section pt="md" style={{ borderTop: "1px solid var(--dg-rule)" }}>
          <FadeIn delay={200}>
            <ApiStatus />
            <Text fz={12} fw={600} mt="md">Solana devnet</Text>
            <Text fz={12} c="dimmed" mt={4} mb="sm">Test network · No real payments</Text>
            <LazyWalletButton fullWidth />
          </FadeIn>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main id="main-content" tabIndex={-1}>
        <Group hiddenFrom="sm" px="md" py="sm" gap="sm">
          <Burger opened={opened} onClick={toggle} size="sm" aria-label={opened ? "Close navigation" : "Open navigation"} aria-expanded={opened} />
          <Text fw={600}>solGPU</Text>
        </Group>
        <Container
          size={1600}
          px={{ base: "md", lg: pathname === "/" ? 18 : 40 }}
          py={{ base: "md", lg: pathname === "/" ? 16 : 32 }}
        >
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
