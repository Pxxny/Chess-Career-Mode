import { useEffect, useMemo, useState } from "react";
import { useSave } from "./useGame";
import type { MatchRecord } from "@/types";
import {
  readMatchArchive,
  mergeMatches,
  subscribeMatchArchive,
} from "@/store/matchArchive";
export function useMatchRecords() {
  const save = useSave();
  const [stored, setStored] = useState<{ id: string; records: MatchRecord[] }>({
    id: "",
    records: [],
  });
  useEffect(() => {
    let active = true;
    const read = () => {
      void readMatchArchive(save.career.id)
        .then((records) => {
          if (active) setStored({ id: save.career.id, records });
        })
        .catch(() => {});
    };
    read();
    const off = subscribeMatchArchive(read);
    return () => {
      active = false;
      off();
    };
  }, [save.career.id]);
  return useMemo(
    () =>
      mergeMatches(
        stored.id === save.career.id ? stored.records : [],
        save.matchArchivePending ?? [],
        save.matches,
      ),
    [save.career.id, save.matches, save.matchArchivePending, stored],
  );
}
