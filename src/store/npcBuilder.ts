import { useLoadingStatus } from "./loadingStatus";
import { buildCareerWorldAsync } from "@/game/npc/buildCareerWorld";
import type { CreationProgress } from "@/game/npc/playerDatabase";
import type { CareerRecord, Npc } from "@/types";
export async function createNpcPopulation(
  career: CareerRecord,
  progress?: (value: CreationProgress) => void,
): Promise<Npc[]> {
  const update=(value:CreationProgress)=>{useLoadingStatus.setState({busy:true,phase:value.phase==="saving"?"Saving player database…":"Building player world…",done:value.done,total:value.total});progress?.(value);};
  useLoadingStatus.setState({busy:true,phase:"Starting world worker…",done:0,total:0});
  if (typeof Worker === "undefined") {
    await new Promise((r) => setTimeout(r, 0));
    try{return await buildCareerWorldAsync(career, update);}finally{useLoadingStatus.setState({busy:false});}
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../game/npc/world.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event) => {
      if (event.data.type === "progress") update(event.data.value);
      else if (event.data.type === "done") {
        worker.terminate();
        useLoadingStatus.setState({busy:false});
        resolve(event.data.npcs);
      } else if (event.data.type === "error") {
        worker.terminate();
        useLoadingStatus.setState({busy:false});
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      useLoadingStatus.setState({busy:false});
      reject(
        new Error(
          "Player database worker could not be loaded. Reload the game and try again.",
        ),
      );
    };
    worker.postMessage(career);
  });
}
