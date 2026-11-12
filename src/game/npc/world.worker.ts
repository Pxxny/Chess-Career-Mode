import { buildCareerWorldAsync } from "./buildCareerWorld";
import type { CareerRecord } from "@/types";
self.onmessage = async (event: MessageEvent<CareerRecord>) => {
  try {
    const npcs = await buildCareerWorldAsync(event.data, (value) =>
      self.postMessage({ type: "progress", value }),
    );
    self.postMessage({ type: "done", npcs });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "Could not generate players.",
    });
  }
};
