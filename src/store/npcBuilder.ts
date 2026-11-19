import { useLoadingStatus } from "./loadingStatus";
import { buildCareerWorldAsync } from "@/game/npc/buildCareerWorld";
import type { CreationProgress } from "@/game/npc/playerDatabase";
import type { CareerRecord, Npc } from "@/types";

function tryWorldWorker(career: CareerRecord, update: (value: CreationProgress) => void): Promise<Npc[] | null> {
  if (typeof Worker === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../game/npc/world.worker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const stop = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const fallback = () => {
      stop();
      resolve(null);
    };
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(fallback, 20000);
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        watch();
        update(data.value);
      } else if (data.type === "done") {
        stop();
        resolve(data.npcs);
      } else if (data.type === "error") {
        stop();
        reject(new Error(data.message));
      }
    };
    worker.onerror = fallback;
    worker.onmessageerror = fallback;
    watch();
    try { worker.postMessage(career); } catch { fallback(); }
  });
}

export async function createNpcPopulation(
  career: CareerRecord,
  progress?: (value: CreationProgress) => void,
): Promise<Npc[]> {
  const update = (value: CreationProgress) => {
    useLoadingStatus.setState({
      busy: true, careerId: career.id, done: value.done, total: value.total,
      phase: value.phase === "saving" ? "Saving player database…" : "Building player world…",
    });
    progress?.(value);
  };
  useLoadingStatus.setState({ busy: true, phase: "Starting world worker…", done: 0, total: 0, careerId: career.id });
  try {
    const world = await tryWorldWorker(career, update);
    if (world) return world;
    await new Promise(resolve => setTimeout(resolve, 0));
    return await buildCareerWorldAsync(career, update);
  } finally {
    useLoadingStatus.setState({ busy: false });
  }
}
