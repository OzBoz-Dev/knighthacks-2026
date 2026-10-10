import { Box, Group, Paper, Stack, Text, Title } from "@mantine/core";
import Image from "next/image";
import styles from "./explore.module.css";

export function MarketHero() {
  return (
    <Paper p="lg" className={styles.hero}>
      <Box className={styles.heroCopy}>
        <Text c="cyan.4" fw={600} fz={10} tt="uppercase" mb={9} style={{ letterSpacing: "1.6px" }}>Your compute, clearly priced</Text>
        <Title order={1} fz={{ base: 23, lg: 28 }} lh={1.25} style={{ letterSpacing: "-0.7px" }}>Real GPU Supply. Global Access.</Title>
        <Text c="dimmed" fz={12} lh={1.8} mt="sm" maw={420}>
          Find the right GPU for your next idea. Compare prices, explore availability, and make your next compute decision with confidence.
        </Text>
      </Box>
      <Image src="/illustrations/world-map.svg" alt="" aria-hidden width={700} height={300} className={styles.worldMap} />
      <Paper p="sm" className={styles.legend}>
        <Text fz={10} fw={600} mb="xs">Global GPU availability</Text>
        <Stack gap={7}>
          {[{ label: "High", color: "cyan.4" }, { label: "Medium", color: "cyan.7" }, { label: "Low", color: "dark.4" }].map(({ label, color }) => (
            <Group key={label} gap={7}><Box w={6} h={6} bg={color} style={{ borderRadius: "50%" }} /><Text fz={10} c="dimmed">{label}</Text></Group>
          ))}
        </Stack>
        <Text fz={9} c="dimmed" mt="sm">Illustrative map · Not live</Text>
      </Paper>
    </Paper>
  );
}
