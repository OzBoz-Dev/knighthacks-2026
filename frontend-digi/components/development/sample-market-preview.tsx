"use client";

import { Alert, Group, Paper, Stack, Table, Text, Title } from "@mantine/core";
import type { Offer } from "@/lib/api/types";
import type { Provenance } from "@/lib/data/provenance";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import { formatGb, formatUsdPerHour } from "@/lib/format";

export function SampleMarketPreview({
  offers,
  provenance,
}: {
  offers: readonly Offer[];
  provenance: Provenance;
}) {
  return (
    <Paper p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2} fz="lg">
            Sample inventory preview
          </Title>
          <DataSourceLabel provenance={provenance} />
        </Group>
        <Alert color="yellow" title="Development sample data, not live inventory">
          These synthetic offers exist only to exercise the UI during development. They are not
          real Vast.ai listings or Databricks results.
        </Alert>
        <Table.ScrollContainer minWidth={480}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>GPU</Table.Th>
                <Table.Th>Total VRAM</Table.Th>
                <Table.Th ta="right">Hourly price</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {offers.map((offer) => (
                <Table.Tr key={offer.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {offer.num_gpus > 1 ? `${offer.num_gpus}× ` : ""}
                      {offer.gpu_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatGb(offer.total_vram_gb)}</Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    {formatUsdPerHour(offer.price_per_hour)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Paper>
  );
}
