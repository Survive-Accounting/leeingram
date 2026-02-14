import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, Target, Brain, Plus, Square, ExternalLink, Clock } from "lucide-react";

const DURATIONS = [15, 25, 35, 45, 60, 90, 120];

type SessionPhase = "setup" | "running" | "report";

export default function FocusTimer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Setup state
  const [intention, setIntention] = useState("");
  const [focusArea, setFocusArea] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [focusDetail, setFocusDetail] = useState<string>("");
  const [duration, setDuration] = useState(25);

  // Timer state
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [totalDuration, setTotalDuration] = useState(25); // tracks extensions
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report state
  const [notes, setNotes] = useState("");

  // Data queries
  const { data: courses } = useQuery({
    queryKey: ["focus-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name").order("course_name");
      return data || [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["focus-chapters", selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data } = await supabase.from("chapters").select("id, chapter_name, chapter_number").eq("course_id", selectedCourseId).order("chapter_number");
      return data || [];
    },
    enabled: !!selectedCourseId,
  });

  const { data: lessons } = useQuery({
    queryKey: ["focus-lessons", selectedChapterId],
    queryFn: async () => {
      if (!selectedChapterId) return [];
      const { data } = await supabase.from("lessons").select("id, lesson_title, lesson_status").eq("chapter_id", selectedChapterId).order("lesson_title");
      return data || [];
    },
    enabled: !!selectedChapterId,
  });

  const { data: emails } = useQuery({
    queryKey: ["focus-emails"],
    queryFn: async () => {
      const { data } = await supabase.from("emails").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: pastSessions, refetch: refetchSessions } = useQuery({
    queryKey: ["focus-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Timer logic
  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && running) {
      setRunning(false);
      toast("⏰ Time's up! You can extend or finish your sprint.");
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, secondsLeft]);

  const selectedLesson = lessons?.find((l) => l.id === selectedLessonId);

  const startSession = async () => {
    if (!intention.trim() || !focusArea) {
      toast.error("Set an intention and focus area first");
      return;
    }
    const detail = focusArea === "content" ? selectedLesson?.lesson_title || "" : focusDetail;
    const { data, error } = await supabase.from("focus_sessions").insert({
      user_id: user!.id,
      intention,
      focus_area: focusArea,
      focus_detail: detail,
      lesson_id: focusArea === "content" && selectedLessonId ? selectedLessonId : null,
      duration_minutes: duration,
      domain: "survive",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setSessionId(data.id);
    setStartedAt(new Date());
    setTotalDuration(duration);
    setSecondsLeft(duration * 60);
    setRunning(true);
    setPhase("running");
    toast.success("Focus session started — no multitasking!");
  };

  const extendSession = () => {
    const newTotal = totalDuration + 15;
    setTotalDuration(newTotal);
    setSecondsLeft((s) => s + 15 * 60);
    setRunning(true);
    toast.success("+15 minutes added — keep going!");
  };

  const endSession = () => {
    setRunning(false);
    setPhase("report");
  };

  const submitReport = async () => {
    if (!sessionId || !startedAt) return;
    const actualMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);
    await supabase.from("focus_sessions").update({
      completed_at: new Date().toISOString(),
      actual_minutes: actualMinutes,
      duration_minutes: totalDuration,
      notes,
    }).eq("id", sessionId);
    toast.success("Sprint logged! Great work.");
    refetchSessions();
    resetAll();
  };

  const resetAll = () => {
    setRunning(false);
    setPhase("setup");
    setSessionId(null);
    setStartedAt(null);
    setNotes("");
    setSecondsLeft(duration * 60);
    setTotalDuration(duration);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = phase === "running" ? ((totalDuration * 60 - secondsLeft) / (totalDuration * 60)) * 100 : 0;
  const elapsedMinutes = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : 0;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> Focus Sprint
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Microfocused. One lesson at a time.</p>
        </div>

        {/* SETUP PHASE */}
        {phase === "setup" && (
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
                  <Select value={focusArea} onValueChange={(v) => { setFocusArea(v); setFocusDetail(""); setSelectedCourseId(""); setSelectedChapterId(""); setSelectedLessonId(""); }}>
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
                      {DURATIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d >= 60 ? `${d / 60}h` : `${d}m`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Content drill-down: Course → Chapter → Lesson */}
              {focusArea === "content" && (
                <div className="space-y-3 border-l-2 border-primary/20 pl-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Course</Label>
                    <Select value={selectedCourseId} onValueChange={(v) => { setSelectedCourseId(v); setSelectedChapterId(""); setSelectedLessonId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                      <SelectContent>
                        {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCourseId && chapters && chapters.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Chapter</Label>
                      <Select value={selectedChapterId} onValueChange={(v) => { setSelectedChapterId(v); setSelectedLessonId(""); }}>
                        <SelectTrigger><SelectValue placeholder="Select chapter..." /></SelectTrigger>
                        <SelectContent>
                          {chapters.map((ch) => <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}: {ch.chapter_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedChapterId && lessons && lessons.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Lesson</Label>
                      <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                        <SelectTrigger><SelectValue placeholder="Select lesson..." /></SelectTrigger>
                        <SelectContent>
                          {lessons.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.lesson_title} ({l.lesson_status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Marketing detail */}
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
        )}

        {/* RUNNING PHASE */}
        {phase === "running" && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-6">
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
                  <span className="text-xs text-muted-foreground mt-1">{focusArea} • {totalDuration}m</span>
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground italic">"{intention}"</p>
                {selectedLesson && (
                  <p className="text-xs text-primary">📖 {selectedLesson.lesson_title}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="outline" size="lg" onClick={() => setRunning(!running)}>
                  {running ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                  {running ? "Pause" : "Resume"}
                </Button>
                {secondsLeft <= 0 && (
                  <Button variant="outline" size="lg" onClick={extendSession}>
                    <Plus className="mr-1 h-4 w-4" /> 15 min
                  </Button>
                )}
                <Button variant="default" size="lg" onClick={endSession}>
                  <Square className="mr-1 h-4 w-4" /> End Sprint
                </Button>
              </div>

              {/* Always show extend option, not just at 0 */}
              {secondsLeft > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={extendSession}>
                  <Plus className="mr-1 h-3 w-3" /> Add 15 min to wrap up
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* REPORT PHASE */}
        {phase === "report" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">Sprint Complete 🎯</h2>
                <p className="text-sm text-muted-foreground mt-1">Log what you accomplished</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="border rounded-md p-3">
                  <p className="text-2xl font-bold text-foreground">{elapsedMinutes}m</p>
                  <p className="text-xs text-muted-foreground">Time Spent</p>
                </div>
                <div className="border rounded-md p-3">
                  <p className="text-2xl font-bold text-foreground">{focusArea === "content" ? "📖" : "📧"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{focusArea}</p>
                </div>
              </div>

              {selectedLesson && (
                <div className="flex items-center gap-2 text-sm border rounded-md p-3 bg-muted/50">
                  <span className="text-muted-foreground">Lesson:</span>
                  <span className="font-medium text-foreground flex-1">{selectedLesson.lesson_title}</span>
                  <Link to={`/lesson/${selectedLessonId}`} className="text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>What did you accomplish?</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Finished the outline, recorded intro, edited first 5 minutes..."
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetAll}>Skip</Button>
                <Button className="flex-1" onClick={submitReport}>
                  Save Sprint Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent sessions */}
        {pastSessions && pastSessions.length > 0 && phase === "setup" && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent Sprints
            </h2>
            <div className="space-y-1.5">
              {pastSessions.map((s: any) => (
                <div key={s.id} className="border rounded-md p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={s.completed_at ? "default" : "secondary"} className="text-[10px]">
                      {s.completed_at ? "✓ Done" : "— Abandoned"}
                    </Badge>
                    <span className="text-muted-foreground flex-1 truncate font-medium">{s.intention}</span>
                    <span className="text-muted-foreground">
                      {s.actual_minutes ? `${s.actual_minutes}m` : `${s.duration_minutes}m`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] capitalize">{s.focus_area}</Badge>
                    {s.focus_detail && <span className="truncate">{s.focus_detail}</span>}
                    {s.lesson_id && (
                      <Link to={`/lesson/${s.lesson_id}`} className="text-primary hover:underline ml-auto shrink-0">
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  {s.notes && (
                    <p className="text-xs text-muted-foreground/80 italic border-t pt-1.5 mt-1">{s.notes}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/50">
                    {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
