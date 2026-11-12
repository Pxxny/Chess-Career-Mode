import { buildCareerWorldAsync } from "@/game/npc/buildCareerWorld";
import type { CreationProgress } from "@/game/npc/playerDatabase";
import type { CareerRecord, Npc } from "@/types";
export async function createNpcPopulation(
  career: CareerRecord,
  progress?: (value: CreationProgress) => void,
): Promise<Npc[]> {
  if (typeof Worker === "undefined") {
    await new Promise((r) => setTimeout(r, 0));
    return buildCareerWorldAsync(career, progress);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../game/npc/world.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event) => {
      if (event.data.type === "progress") progress?.(event.data.value);
      else if (event.data.type === "done") {
        worker.terminate();
        resolve(event.data.npcs);
      } else if (event.data.type === "error") {
        worker.terminate();
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(
        new Error(
          "Player database worker could not be loaded. Reload the game and try again.",
        ),
      );
    };
    worker.postMessage(career);
  });
}
