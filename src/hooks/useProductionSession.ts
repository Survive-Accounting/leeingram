import { useCallback } from "react";

const STORAGE_KEY = "asset-factory-last-session";

export interface ProductionSession {
  courseId: string;
  courseName: string;
  chapterId: string;
  chapterName: string;
  chapterNumber: number;
  activeTab: string;
  lastPhase: string;
  updatedAt: string;
}

export function useProductionSession() {
  const getSession = useCallback((): ProductionSession | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const saveSession = useCallback((session: Omit<ProductionSession, "updatedAt">) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...session, updatedAt: new Date().toISOString() })
    );
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { getSession, saveSession, clearSession };
}
