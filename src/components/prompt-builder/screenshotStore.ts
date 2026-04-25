/** In-memory store for the 10 numbered screenshot slots. Cleared on refresh. */
import { useSyncExternalStore } from "react";

export interface Shot {
  /** 1-based slot number (1..10). */
  n: number;
  dataUrl: string;
  createdAt: number;
}

const MAX_SLOTS = 10;

let shots: Shot[] = [];
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export const screenshotStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot(): Shot[] {
    return shots;
  },
  /** Adds a shot to the next available slot (1..10). Returns the slot number, or null if full. */
  add(dataUrl: string): number | null {
    const used = new Set(shots.map((s) => s.n));
    let n: number | null = null;
    for (let i = 1; i <= MAX_SLOTS; i++) {
      if (!used.has(i)) { n = i; break; }
    }
    if (n == null) return null;
    shots = [...shots, { n, dataUrl, createdAt: Date.now() }].sort((a, b) => a.n - b.n);
    emit();
    return n;
  },
  remove(n: number) {
    shots = shots.filter((s) => s.n !== n);
    emit();
  },
  clear() {
    shots = [];
    emit();
  },
};

export function useShots(): Shot[] {
  return useSyncExternalStore(screenshotStore.subscribe, screenshotStore.getSnapshot, screenshotStore.getSnapshot);
}
