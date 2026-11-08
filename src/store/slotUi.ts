import { create } from 'zustand';

/** Which screen the player sees while no character is open: the slot list, or character creation for one slot. */
interface SlotUi {
  /** The slot a new character is being created in, or null while the slot list is shown. */
  creatingSlot: number | null;
  startCreating: (slot: number) => void;
  cancel: () => void;
}

export const useSlotUi = create<SlotUi>()((set) => ({
  creatingSlot: null,
  startCreating: (slot) => set({ creatingSlot: slot }),
  cancel: () => set({ creatingSlot: null }),
}));
