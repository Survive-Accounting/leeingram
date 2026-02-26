import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "active-workspace";

export interface ActiveWorkspace {
  courseId: string;
  courseName: string;
  chapterId: string;
  chapterName: string;
  chapterNumber: number;
  updatedAt: string;
}

// Simple pub/sub so all hook consumers re-render on change
const listeners = new Set<() => void>();
let cachedSnapshot: ActiveWorkspace | null = null;
let cachedRaw: string | null = null;

function emitChange() {
  // Invalidate cache on change
  cachedRaw = null;
  cachedSnapshot = null;
  listeners.forEach((l) => l());
}

function getSnapshot(): ActiveWorkspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    cachedSnapshot = raw ? JSON.parse(raw) : null;
    return cachedSnapshot;
  } catch {
    return null;
  }
}

export function useActiveWorkspace() {
  const workspace = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getSnapshot,
    () => null,
  );

  const setWorkspace = useCallback((ws: Omit<ActiveWorkspace, "updatedAt">) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...ws, updatedAt: new Date().toISOString() }));
    emitChange();
  }, []);

  const clearWorkspace = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  }, []);

  return { workspace, setWorkspace, clearWorkspace };
}
