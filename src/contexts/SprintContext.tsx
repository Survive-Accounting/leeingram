import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SprintState {
  sessionId: string;
  lessonId: string | null;
  intention: string;
  focusDomain: string;
  focusArea: string;
  focusDetail: string;
  duration: number;
  totalDuration: number;
  startedAt: string; // ISO string
  secondsLeft: number;
  running: boolean;
}

interface SprintContextType {
  activeSessionId: string | null;
  activeLessonId: string | null;
  sprintState: SprintState | null;
  setActiveSession: (sessionId: string | null, lessonId?: string | null) => void;
  saveSprintState: (state: SprintState) => void;
  updateSprintTimer: (secondsLeft: number, running: boolean, totalDuration?: number) => void;
  clearSprintState: () => void;
  logAction: (actionType: string, actionDetail?: string, lessonId?: string) => Promise<void>;
}

const SPRINT_KEY = "lovable_active_sprint";

function loadSprint(): SprintState | null {
  try {
    const raw = localStorage.getItem(SPRINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveSprint(state: SprintState | null) {
  if (state) {
    localStorage.setItem(SPRINT_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(SPRINT_KEY);
  }
}

const SprintContext = createContext<SprintContextType>({
  activeSessionId: null,
  activeLessonId: null,
  sprintState: null,
  setActiveSession: () => {},
  saveSprintState: () => {},
  updateSprintTimer: () => {},
  clearSprintState: () => {},
  logAction: async () => {},
});

export function SprintProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sprintState, setSprintState] = useState<SprintState | null>(loadSprint);

  const activeSessionId = sprintState?.sessionId ?? null;
  const activeLessonId = sprintState?.lessonId ?? null;

  // Keep localStorage in sync
  useEffect(() => {
    saveSprint(sprintState);
  }, [sprintState]);

  const setActiveSession = useCallback((sessionId: string | null, lessonId?: string | null) => {
    if (!sessionId) {
      // Don't clear sprint state here — use clearSprintState for that
    }
  }, []);

  const saveSprintState = useCallback((state: SprintState) => {
    setSprintState(state);
  }, []);

  const updateSprintTimer = useCallback((secondsLeft: number, running: boolean, totalDuration?: number) => {
    setSprintState(prev => {
      if (!prev) return prev;
      return { ...prev, secondsLeft, running, totalDuration: totalDuration ?? prev.totalDuration };
    });
  }, []);

  const clearSprintState = useCallback(() => {
    setSprintState(null);
    saveSprint(null);
  }, []);

  const logAction = useCallback(async (actionType: string, actionDetail?: string, lessonId?: string) => {
    if (!activeSessionId || !user) return;
    await supabase.from("sprint_activity_log").insert({
      session_id: activeSessionId,
      user_id: user.id,
      action_type: actionType,
      action_detail: actionDetail || "",
      lesson_id: lessonId || activeLessonId || null,
    });
  }, [activeSessionId, activeLessonId, user]);

  return (
    <SprintContext.Provider value={{
      activeSessionId,
      activeLessonId,
      sprintState,
      setActiveSession,
      saveSprintState,
      updateSprintTimer,
      clearSprintState,
      logAction,
    }}>
      {children}
    </SprintContext.Provider>
  );
}

export const useSprint = () => useContext(SprintContext);
