import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSprint } from "@/contexts/SprintContext";
import { Clock, Pause, Play, Square } from "lucide-react";
import { SprintCompletionDialog } from "@/components/SprintCompletionDialog";

export function SprintTimerBar() {
  const { sprintState, updateSprintTimer, clearSprintState } = useSprint();
  const navigate = useNavigate();
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  // Sync from sprint state
  useEffect(() => {
    if (!sprintState) return;
    const elapsed = Math.floor((Date.now() - new Date(sprintState.startedAt).getTime()) / 1000);
    const total = sprintState.totalDuration * 60;
    const remaining = Math.max(0, total - elapsed);
    setSecondsLeft(sprintState.running ? remaining : sprintState.secondsLeft);
    setRunning(sprintState.running && remaining > 0);
    if (remaining === 0 && sprintState.running) {
      setTimerExpired(true);
      setShowCompletion(true);
    }
  }, [sprintState?.sessionId, sprintState?.totalDuration]);

  // Tick
  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            setRunning(false);
            setTimerExpired(true);
            setShowCompletion(true);
            updateSprintTimer(0, false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, secondsLeft > 0]);

  // Sync back to context periodically
  useEffect(() => {
    if (sprintState) {
      updateSprintTimer(secondsLeft, running);
    }
  }, [secondsLeft, running]);

  if (!sprintState || location.pathname === "/focus") return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const totalSecs = sprintState.totalDuration * 60;
  const progress = totalSecs > 0 ? ((totalSecs - secondsLeft) / totalSecs) * 100 : 0;
  const isLow = secondsLeft <= 120 && secondsLeft > 0;

  const handleToggle = () => {
    setRunning(!running);
    updateSprintTimer(secondsLeft, !running);
  };

  const handleEnd = () => {
    setRunning(false);
    updateSprintTimer(secondsLeft, false);
    setShowCompletion(true);
  };

  const handleGoToFocus = () => {
    navigate("/focus");
  };

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 cursor-pointer"
        onClick={handleGoToFocus}
        style={{ height: "36px" }}
      >
        {/* Progress background */}
        <div
          className="absolute inset-0"
          style={{
            background: "rgba(10,10,18,0.88)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(218,165,32,0.2)",
          }}
        />
        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 h-[2px] transition-all duration-1000 ease-linear"
          style={{
            width: `${progress}%`,
            background: isLow
              ? "linear-gradient(90deg, rgba(239,68,68,0.8), rgba(239,68,68,0.6))"
              : "linear-gradient(90deg, rgba(218,165,32,0.8), rgba(218,165,32,0.4))",
          }}
        />
        {/* Content */}
        <div className="relative h-full flex items-center justify-between px-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Clock className="h-3.5 w-3.5" style={{ color: isLow ? "rgba(239,68,68,0.8)" : "rgba(218,165,32,0.8)" }} />
            <span
              className="font-mono text-sm font-bold tracking-wider"
              style={{ color: isLow ? "rgba(239,68,68,0.9)" : "rgba(218,165,32,0.95)" }}
            >
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </span>
            <span className="text-xs truncate max-w-[200px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              {sprintState.intention}
            </span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleToggle}
              className="p-1.5 rounded-md transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleEnd}
              className="p-1.5 rounded-md transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Spacer to push content down */}
      <div style={{ height: "36px" }} />

      <SprintCompletionDialog
        open={showCompletion}
        timerExpired={timerExpired}
        onClose={() => {
          setShowCompletion(false);
          setTimerExpired(false);
        }}
      />
    </>
  );
}
