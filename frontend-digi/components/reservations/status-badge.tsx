import { Badge } from "@mantine/core";
import type { StatusTone, StatusView } from "@/lib/reservations/status";

const COLOR: Record<StatusTone, string> = { success: "green", neutral: "gray", progress: "blue", failure: "red" };

export function StatusBadge({ view }: { view: StatusView }) {
  return (
    <Badge color={COLOR[view.tone]} variant="light" tt="none" fw={600} title={view.note}>
      {view.label}
    </Badge>
  );
}
