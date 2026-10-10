import { PageHeader } from "@/components/layout/page-header";
import { MatchWorkspace } from "@/components/match/match-workspace";

export default function MatchPage() {
  return (
    <>
      <PageHeader
        title="Match"
        description="Enter your VRAM requirement and hourly budget to get ranked GPU offers with plain-language explanations."
      />
      <MatchWorkspace />
    </>
  );
}
