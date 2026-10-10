import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="xl" gap="md">
      <Stack gap={8}>
        <Title order={1} fz={{ base: 26, lg: 32 }} lh={1.15} style={{ letterSpacing: "-0.6px" }}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" fz={15} maw={720}>
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group>{actions}</Group>}
    </Group>
  );
}
