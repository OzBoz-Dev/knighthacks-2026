import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/async-state";

export default function MatchPage() {
  return (
    <>
      <PageHeader
        title="Match"
        description="Enter your VRAM requirement and hourly budget to get ranked GPU offers with plain-language explanations."
      />
      <EmptyState
        title="Matching not built yet"
        description="The requirements form, ranked recommendations, and exclusion summary will appear here once connected to the solGPU API."
      />
    </>
  );
}
