import { useSyncExternalStore } from "react";

/**
 * While the trial-end choice is pending (status loading or dialog open), the
 * initial-password offer must wait: the student chooses first, password last.
 */
let pending = false;
const listeners = new Set<() => void>();

export function setTrialChoicePending(next: boolean) {
  if (pending === next) return;
  pending = next;
  listeners.forEach((l) => l());
}

export function useTrialChoicePending() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => pending,
    () => false,
  );
}
