"use client";

import { AppShell, Box, Burger, Container, Group, NavLink, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCompass, IconLayersIntersect, IconReceipt, IconTarget, IconWallet } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
      <AppShell.Navbar bg="dark.8" p="sm" aria-label="Sidebar">
        <AppShell.Section p="xs" pt="md" pb={32}>
          <Burger hiddenFrom="sm" opened={opened} onClick={close} size="sm" mb="md" aria-label="Close navigation" />
          <Group renderRoot={(props) => <Link {...props} href="/" onClick={close} />} gap={10} wrap="nowrap" style={{ textDecoration: "none" }}>
            <ThemeIcon variant="light" size={36} radius="md">
              <IconLayersIntersect size={25} stroke={1.7} aria-hidden />
            </ThemeIcon>
            <Box>
              <Text fw={700} fz={21} c="dark.0" lh={1.2} style={{ letterSpacing: "-0.6px" }}>
                digi<Box component="span" c="cyan.4">GPU</Box>
              </Text>
              <Text c="dimmed" fz={10} mt={4}>GPU marketplace explorer</Text>
            </Box>
          </Group>
        </AppShell.Section>
        <AppShell.Section grow component="nav" aria-label="Primary">
          <Text c="dimmed" fz={10} fw={600} tt="uppercase" px="sm" mb="sm" style={{ letterSpacing: "1.5px" }}>
            Workspace
          </Text>
          <Stack gap={6}>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <NavLink
                key={href}
                component={Link}
                href={href}
                label={label}
                leftSection={<Icon size={18} stroke={1.6} aria-hidden />}
                active={isActive(pathname, href)}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                onClick={close}
                py={12}
                styles={{ root: { borderRadius: 7 }, label: { fontSize: 13, fontWeight: 500 } }}
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Paper p="sm" radius="md" bg="dark.9">
            <Group gap={9} wrap="nowrap">
              <ThemeIcon size={28} color="cyan" variant="light" radius="xl"><IconWallet size={15} aria-hidden /></ThemeIcon>
              <Box>
                <Text fz={11} fw={600}>Solana devnet</Text>
                <Text fz={10} c="dimmed" mt={3}>Test network · No real payments</Text>
              </Box>
            </Group>
          </Paper>
          <Text c="dimmed" fz={10} px={4} pt="sm">Compare. Choose. Keep the receipt.</Text>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main id="main-content" tabIndex={-1}>
        <Group hiddenFrom="sm" px="md" py="sm" gap="sm">
          <Burger opened={opened} onClick={toggle} size="sm" aria-label={opened ? "Close navigation" : "Open navigation"} aria-expanded={opened} />
          <Text fw={600}>digiGPU</Text>
        </Group>
        <Container size={1600} px={{ base: "md", lg: "lg" }} py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
