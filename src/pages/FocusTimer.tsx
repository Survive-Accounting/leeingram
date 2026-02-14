import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, Timer, Target, Brain } from "lucide-react";

const DURATIONS = [15, 25, 35, 45, 60];

export default function FocusTimer() {
  const { user } = useAuth();
  const [intention, setIntention] = useState("");
  const [focusArea, setFocusArea] = useState<string>("");
  const [focusDetail, setFocusDetail] = useState<string>("");
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch lessons for content detail picker
  const { data: lessons } = useQuery({
    queryKey: ["focus-lessons"],
    queryFn: async () => {
      const { data } = await supabase.from("lessons").select("id, lesson_title").order("lesson_title");
      return data || [];
    },
  });

  // Fetch emails for marketing detail picker
  const { data: emails } = useQuery({
    queryKey: ["focus-emails"],
    queryFn: async () => {
      const { data } = await supabase.from("emails").select("id, title").order("title");
      return data || [];
    },
  });

  // Fetch past sessions
  const { data: pastSessions } = useQuery({
    queryKey: ["focus-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && running) {
      setRunning(false);
      completeSession();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, secondsLeft]);

  const startSession = async () => {
    if (!intention.trim() || !focusArea) {
      toast.error("Set an intention and focus area first");
      return;
    }
    const { data, error } = await supabase.from("focus_sessions").insert({
      user_id: user!.id,
      intention,
      focus_area: focusArea,
      focus_detail: focusDetail,
      duration_minutes: duration,
      domain: "survive",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setSessionId(data.id);
    setSecondsLeft(duration * 60);
    setRunning(true);
    toast.success("Focus session started — no multitasking!");
  };

  const completeSession = async () => {
    if (sessionId) {
      await supabase.from("focus_sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId);
      toast.success("Session complete! Great focus.");
      setSessionId(null);
    }
  };

  const resetSession = () => {
    setRunning(false);
    setSecondsLeft(duration * 60);
    setSessionId(null);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = sessionId ? ((duration * 60 - secondsLeft) / (duration * 60)) * 100 : 0;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Focus Sprint
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Microfocused. No multitasking.</p>
        </div>

        {!sessionId ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Intention</Label>
                <Input
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                  placeholder="What will you accomplish this sprint?"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Focus Area</Label>
                  <Select value={focusArea} onValueChange={(v) => { setFocusArea(v); setFocusDetail(""); }}>
                    <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="content">Content</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Select value={String(duration)} onValueChange={(v) => { setDuration(Number(v)); setSecondsLeft(Number(v) * 60); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {focusArea === "content" && lessons && lessons.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Which lesson?</Label>
                  <Select value={focusDetail} onValueChange={setFocusDetail}>
                    <SelectTrigger><SelectValue placeholder="Pick a lesson..." /></SelectTrigger>
                    <SelectContent>
                      {lessons.map((l) => <SelectItem key={l.id} value={l.lesson_title}>{l.lesson_title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {focusArea === "marketing" && emails && emails.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Which email?</Label>
                  <Select value={focusDetail} onValueChange={setFocusDetail}>
                    <SelectTrigger><SelectValue placeholder="Pick an email..." /></SelectTrigger>
                    <SelectContent>
                      {emails.map((e) => <SelectItem key={e.id} value={e.title}>{e.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={startSession} disabled={!intention.trim() || !focusArea}>
                <Play className="mr-2 h-4 w-4" /> Start Focus Sprint
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-6">
              {/* Progress ring */}
              <div className="relative w-48 h-48">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="4" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    className="stroke-primary"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-mono font-bold text-foreground">
                    {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">{focusArea} • {duration}m</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center italic">"{intention}"</p>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={() => setRunning(!running)}>
                  {running ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                  {running ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" size="lg" onClick={resetSession}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent sessions */}
        {pastSessions && pastSessions.length > 0 && !sessionId && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Recent Sprints</h2>
            <div className="space-y-1.5">
              {pastSessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 text-xs border rounded-md p-2.5">
                  <Badge variant={s.completed_at ? "default" : "secondary"} className="text-[10px]">
                    {s.completed_at ? "✓" : "—"}
                  </Badge>
                  <span className="text-muted-foreground flex-1 truncate">{s.intention}</span>
                  <span className="text-muted-foreground">{s.duration_minutes}m</span>
                  <span className="text-muted-foreground">{s.focus_area}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
