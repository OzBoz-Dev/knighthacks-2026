import { Group, Text } from "@mantine/core";
import type { MatchResponse } from "@/lib/api/types";
import { exclusionRows, offersText } from "@/lib/match/exclusions";

export function ExclusionSummary({ response }: { response: MatchResponse }) {
  const rows = exclusionRows(response.excluded);
  return (
    <div>
      <Text fz={14} fw={600} className="tabular" role="status" aria-live="polite">
        Checked {offersText(response.checked)} · {response.eligible} meet your requirements
      </Text>
      {rows.length > 0 && (
        <Group component="ul" gap="md" mt={4} p={0} m={0} style={{ listStyle: "none" }} aria-label="Offers excluded by each requirement">
          {rows.map(({ key, label, count }) => (
            <Text component="li" key={key} fz={12} c="dimmed" className="tabular">{label} excluded {offersText(count)}</Text>
          ))}
        </Group>
      )}
    </div>
  );
}
