import { useSave } from '@/hooks/useGame';
import { useMemo } from 'react';
import { buildOpeningPerformance } from '@/game/openings/stats';
import { MasteryBadge } from './openings/MasteryBadge';
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
  const save=useSave();
  const ready=useMemo(()=>buildOpeningPerformance(save,db).slice(0,4),[save,db]);
  const load = useOpeningStore((s) => s.load);
  const [view, setView] = useState<ViewId>("browse");
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      {ready.length>0&&<div className="mb-4 flex flex-wrap gap-2">{ready.map(p=><span key={p.family} className="rounded-xl bg-navy-800 p-2 text-xs"><span className="mr-2">{p.family}</span><MasteryBadge perf={p}/></span>)}</div>}
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
