import { SectionMenu } from "@/components/ui";
import { useEffect, useState } from "react";
import { useOpeningDb, useOpeningStore } from "@/store/openingStore";
import { BrowseOpenings } from "./openings/BrowseOpenings";
import { ImportPanel } from "./openings/ImportPanel";
import { Performance } from "./openings/Performance";
import { Preferences } from "./openings/Preferences";

const VIEWS = [
  { id: "browse", label: "Browse" },
  { id: "preferences", label: "Preferences" },
  { id: "performance", label: "Performance" },
  { id: "import", label: "Import" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

export function OpeningsTab() {
  const db = useOpeningDb();
  const load = useOpeningStore((s) => s.load);
  const [view, setView] = useState<ViewId>("browse");
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <SectionMenu
        label="Opening tools"
        items={VIEWS}
        active={view}
        onChange={setView}
      />
      {view === "browse" && <BrowseOpenings db={db} />}
      {view === "preferences" && <Preferences db={db} />}
      {view === "performance" && <Performance db={db} />}
      {view === "import" && <ImportPanel />}
    </>
  );
}
