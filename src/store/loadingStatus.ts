import { create } from "zustand";

export const useLoadingStatus = create<{
  phase: string;
  done: number;
  total: number;
  busy: boolean;
  careerId: string | null;
  hydrationError: string | null;
}>(() => ({ phase: "", done: 0, total: 0, busy: false, careerId: null, hydrationError: null }));
