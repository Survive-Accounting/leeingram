import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SprintContextType {
  activeSessionId: string | null;
  activeLessonId: string | null;
  setActiveSession: (sessionId: string | null, lessonId?: string | null) => void;
  logAction: (actionType: string, actionDetail?: string, lessonId?: string) => Promise<void>;
}

const SprintContext = createContext<SprintContextType>({
  activeSessionId: null,
  activeLessonId: null,
  setActiveSession: () => {},
  logAction: async () => {},
});

export function SprintProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeSessionId, setSessionId] = useState<string | null>(null);
  const [activeLessonId, setLessonId] = useState<string | null>(null);

  const setActiveSession = useCallback((sessionId: string | null, lessonId?: string | null) => {
    setSessionId(sessionId);
    setLessonId(lessonId ?? null);
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
    <SprintContext.Provider value={{ activeSessionId, activeLessonId, setActiveSession, logAction }}>
      {children}
    </SprintContext.Provider>
  );
}

export const useSprint = () => useContext(SprintContext);
