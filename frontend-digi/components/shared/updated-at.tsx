import { Text, type TextProps } from "@mantine/core";
import { formatTimestamp, parseTimestamp } from "@/lib/format";

export function UpdatedAt({
  value,
  prefix = "Updated",
  ...textProps
}: { value: string | null | undefined; prefix?: string } & TextProps) {
  const date = parseTimestamp(value);
  const label = formatTimestamp(value);
  return (
    <Text size="sm" c="dimmed" {...textProps}>
      {prefix}{" "}
      {date && label ? (
        <time dateTime={date.toISOString()} title={date.toISOString()}>
          {label}
        </time>
      ) : (
        "time unknown"
      )}
    </Text>
  );
}
