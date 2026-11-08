import { useSyncExternalStore } from "react";
// Transient leases remain while a detached simulation finishes. They never enter a saved game.
const leases = new Map<string, symbol>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export function acquireMatch(careerId: string, token: symbol): boolean {
  const current = leases.get(careerId);
  if (current && current !== token) return false;
  leases.set(careerId, token);
  notify();
  return true;
}
export function releaseMatch(careerId: string, token: symbol): void {
  if (leases.get(careerId) !== token) return;
  leases.delete(careerId);
  notify();
}
export const matchRunning = (careerId: string): boolean => leases.has(careerId);
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useMatchRunning = (careerId: string): boolean =>
  useSyncExternalStore(subscribe, () => matchRunning(careerId));
