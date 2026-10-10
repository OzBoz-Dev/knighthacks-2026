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
      <Stack gap={6}>
        <Title order={1} fz={28}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" maw={720}>
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group>{actions}</Group>}
    </Group>
  );
}
