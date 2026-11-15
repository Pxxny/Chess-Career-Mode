import { PageHeader } from "@/components/ui";
import { ChangelogView } from "@/features/changelog/ChangelogView";

export function ChangelogPage() {
  return (
    <>
      <PageHeader
        title="Changelog"
        description="Every release in one place, newest first. Tap a release to see what changed."
      />
      <ChangelogView />
    </>
  );
}
