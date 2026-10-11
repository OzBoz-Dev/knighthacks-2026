"use client";

import { Alert, Button, Group, Loader, Paper, Skeleton, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <Stack gap="sm" role="status" aria-live="polite">
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Group>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={36} radius="sm" />
      ))}
    </Stack>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Paper p="xl" radius="md">
      <Stack gap="xs" align="flex-start">
        <Title order={2} fz="lg">
          {title}
        </Title>
        {description && (
          <Text c="dimmed" size="sm" maw={640}>
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Paper>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert color="red" title={title} role="alert">
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{message}</Text>
        {onRetry && (
          <Button size="xs" variant="light" color="red" onClick={onRetry} loading={retrying}>
            Retry
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
