import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSprint } from "@/contexts/SprintContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Play, Pause, Target, Brain, Plus, Square, ExternalLink, Clock, Music, Trash2 } from "lucide-react";

const DURATIONS = [15, 25, 35, 45, 60, 90, 120];

const ACTION_LABELS: Record<string, string> = {
  status_change: "📋 Status Change",
  ai_generate: "✨ AI Generation",
  manual_edit: "✏️ Manual Edit",
  sheet_generated: "📊 Sheet Created",
  lesson_created: "📖 Lesson Created",
};

const DOMAIN_FOCUS_AREAS: Record<string, { value: string; label: string }[]> = {
  survive: [
    { value: "content", label: "Content Factory" },
    { value: "marketing", label: "Marketing Factory" },
    { value: "ideas", label: "Idea Factory" },
  ],
  writing: [
    { value: "story_idea", label: "Story Idea" },
  ],
  leeingram: [
    { value: "vlog_series", label: "VLOG Series" },
  ],
  prof_ingram: [
    { value: "course_work", label: "Course Work" },
  ],
  travel: [
    { value: "planning", label: "Trip Planning" },
  ],
};

const DOMAIN_LABELS: Record<string, string> = {
  survive: "Survive Accounting",
  writing: "Writing [for Ben]",
  leeingram: "Leeingram.co",
  prof_ingram: "Prof Ingram",
  travel: "Travel",
};

type SessionPhase = "setup" | "running" | "report";

export default function FocusTimer() {
  const { user } = useAuth();
  const { sprintState, saveSprintState, updateSprintTimer, clearSprintState } = useSprint();
  const queryClient = useQueryClient();

  // Setup state
  const [intention, setIntention] = useState("");
  const [focusDomain, setFocusDomain] = useState<string>("");
  const [focusArea, setFocusArea] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [focusDetail, setFocusDetail] = useState<string>("");
  const [duration, setDuration] = useState(25);
  const [showMusic, setShowMusic] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });

  // Running state
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [totalDuration, setTotalDuration] = useState(25);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report state
  const [notes, setNotes] = useState("");
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Restore from persisted sprint state on mount
  useEffect(() => {
    if (sprintState && phase === "setup") {
      setSessionId(sprintState.sessionId);
      setIntention(sprintState.intention);
      setFocusDomain(sprintState.focusDomain);
      setFocusArea(sprintState.focusArea);
      setFocusDetail(sprintState.focusDetail);
      setTotalDuration(sprintState.totalDuration);
      setStartedAt(new Date(sprintState.startedAt));

      // Calculate elapsed time since last save
      const savedAt = Date.now();
      const elapsedSinceStart = Math.floor((savedAt - new Date(sprintState.startedAt).getTime()) / 1000);
      const totalSeconds = sprintState.totalDuration * 60;
      const remaining = Math.max(0, totalSeconds - elapsedSinceStart);

      setSecondsLeft(sprintState.running ? remaining : sprintState.secondsLeft);
      setRunning(sprintState.running && remaining > 0);
      setSelectedLessonId(sprintState.lessonId || "");
      setPhase("running");
    }
  }, []); // Only on mount

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

  const { data: storyIdeas } = useQuery({
    queryKey: ["focus-story-ideas"],
    queryFn: async () => {
      const { data } = await supabase.from("story_ideas").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: vlogSeasons } = useQuery({
    queryKey: ["focus-vlog-seasons"],
    queryFn: async () => {
      const { data } = await supabase.from("vlog_seasons").select("id, title, season_number, series_name").order("season_number");
      return data || [];
    },
  });

  const { data: emails } = useQuery({
    queryKey: ["focus-emails"],
    queryFn: async () => {
      const { data } = await supabase.from("emails").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: musicLinks } = useQuery({
    queryKey: ["music-links"],
    queryFn: async () => {
      const { data } = await supabase.from("music_links").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("music_links").insert({ user_id: user!.id, title: newLink.title, youtube_url: newLink.url });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["music-links"] }); setNewLink({ title: "", url: "" }); },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("music_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["music-links"] }),
  });

  const { data: pastSessions, refetch: refetchSessions } = useQuery({
    queryKey: ["focus-sessions-detailed"],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from("focus_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!sessions) return [];

      const lessonIds = [...new Set(sessions.filter((s: any) => s.lesson_id).map((s: any) => s.lesson_id))];
      let lessonMap: Record<string, any> = {};
      if (lessonIds.length > 0) {
        const { data: lessonData } = await supabase.from("lessons").select("id, lesson_title, lesson_status").in("id", lessonIds);
        if (lessonData) lessonMap = Object.fromEntries(lessonData.map((l) => [l.id, l]));
      }

      const sessionIds = sessions.map((s: any) => s.id);
      const { data: activities } = await supabase.from("sprint_activity_log").select("session_id, action_type").in("session_id", sessionIds);
      const activityCountMap: Record<string, number> = {};
      activities?.forEach((a: any) => { activityCountMap[a.session_id] = (activityCountMap[a.session_id] || 0) + 1; });

      return sessions.map((s: any) => ({
        ...s,
        lesson: s.lesson_id ? lessonMap[s.lesson_id] || null : null,
        activityCount: activityCountMap[s.id] || 0,
      }));
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
      updateSprintTimer(0, false);
      toast("⏰ Time's up! You can extend or finish your sprint.");
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, secondsLeft]);

  // Persist timer state periodically
  useEffect(() => {
    if (phase === "running" && sessionId && startedAt) {
      updateSprintTimer(secondsLeft, running, totalDuration);
    }
  }, [secondsLeft, running, totalDuration]);

  const selectedLesson = lessons?.find((l) => l.id === selectedLessonId);

  const startSession = async () => {
    if (!intention.trim() || !focusDomain || !focusArea) {
      toast.error("Set an intention, domain, and focus area first");
      return;
    }
    let detail = focusDetail;
    if (focusDomain === "survive" && focusArea === "content") {
      detail = selectedLesson?.lesson_title || "";
    }

    const { data, error } = await supabase.from("focus_sessions").insert({
      user_id: user!.id,
      intention,
      focus_area: `${focusDomain}:${focusArea}`,
      focus_detail: detail,
      lesson_id: focusDomain === "survive" && focusArea === "content" && selectedLessonId ? selectedLessonId : null,
      duration_minutes: duration,
      domain: focusDomain,
    }).select("id").single();

    if (error) { toast.error(error.message); return; }

    const now = new Date();
    setSessionId(data.id);
    setStartedAt(now);
    setTotalDuration(duration);
    setSecondsLeft(duration * 60);
    setRunning(true);
    setPhase("running");

    saveSprintState({
      sessionId: data.id,
      lessonId: selectedLessonId || null,
      intention,
      focusDomain,
      focusArea,
      focusDetail: detail,
      duration,
      totalDuration: duration,
      startedAt: now.toISOString(),
      secondsLeft: duration * 60,
      running: true,
    });

    toast.success("Focus session started — no multitasking!");
  };

  const extendSession = () => {
    const newTotal = totalDuration + 15;
    setTotalDuration(newTotal);
    setSecondsLeft((s) => s + 15 * 60);
    setRunning(true);
    toast.success("+15 minutes added — keep going!");
  };

  const endSession = async () => {
    setRunning(false);
    if (sessionId) {
      const { data } = await supabase
        .from("sprint_activity_log")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      setActivityLog(data || []);
    }
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
    clearSprintState();
    refetchSessions();
    resetAll();
  };

  const resetAll = () => {
    setRunning(false);
    setPhase("setup");
    setSessionId(null);
    clearSprintState();
    setStartedAt(null);
    setNotes("");
    setActivityLog([]);
    setSecondsLeft(duration * 60);
    setTotalDuration(duration);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progress = phase === "running" ? ((totalDuration * 60 - secondsLeft) / (totalDuration * 60)) * 100 : 0;
  const elapsedMinutes = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : 0;

  const availableFocusAreas = focusDomain ? (DOMAIN_FOCUS_AREAS[focusDomain] || []) : [];

  return (
    <div className="max-w-lg mx-auto py-8 space-y-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> Focus Sprint
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Microfocused. One task at a time.</p>
      </div>

      {/* SETUP PHASE */}
      {phase === "setup" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Intention</Label>
              <Textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Describe what you'll accomplish this sprint. Be specific about the outcome you want — what will be different when the timer ends?"
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Domain</Label>
                <Select value={focusDomain} onValueChange={(v) => { setFocusDomain(v); setFocusArea(""); setFocusDetail(""); setSelectedCourseId(""); setSelectedChapterId(""); setSelectedLessonId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Choose domain..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
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

            {focusDomain && availableFocusAreas.length > 0 && (
              <div className="space-y-1.5">
                <Label>Focus Area</Label>
                <Select value={focusArea} onValueChange={(v) => { setFocusArea(v); setFocusDetail(""); setSelectedCourseId(""); setSelectedChapterId(""); setSelectedLessonId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Choose focus..." /></SelectTrigger>
                  <SelectContent>
                    {availableFocusAreas.map((fa) => (
                      <SelectItem key={fa.value} value={fa.value}>{fa.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Survive: Content — Course > Chapter > Lesson */}
            {focusDomain === "survive" && focusArea === "content" && (
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

            {/* Survive: Marketing — pick email */}
            {focusDomain === "survive" && focusArea === "marketing" && emails && emails.length > 0 && (
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

            {/* Writing: Story Ideas */}
            {focusDomain === "writing" && focusArea === "story_idea" && storyIdeas && storyIdeas.length > 0 && (
              <div className="space-y-1.5">
                <Label>Which story?</Label>
                <Select value={focusDetail} onValueChange={setFocusDetail}>
                  <SelectTrigger><SelectValue placeholder="Pick a story idea..." /></SelectTrigger>
                  <SelectContent>
                    {storyIdeas.map((s) => <SelectItem key={s.id} value={s.title}>{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Leeingram: VLOG Seasons */}
            {focusDomain === "leeingram" && focusArea === "vlog_series" && vlogSeasons && vlogSeasons.length > 0 && (
              <div className="space-y-1.5">
                <Label>Which season?</Label>
                <Select value={focusDetail} onValueChange={setFocusDetail}>
                  <SelectTrigger><SelectValue placeholder="Pick a season..." /></SelectTrigger>
                  <SelectContent>
                    {vlogSeasons.map((s) => <SelectItem key={s.id} value={s.title}>S{s.season_number}: {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Generic detail for ideas/other areas */}
            {focusDomain && focusArea && !["content", "marketing"].includes(focusArea) && focusDomain === "survive" && focusArea === "ideas" && (
              <div className="space-y-1.5">
                <Label>What specifically?</Label>
                <Input value={focusDetail} onChange={(e) => setFocusDetail(e.target.value)} placeholder="Describe the focus..." />
              </div>
            )}

            {/* Music Library Toggle */}
            <Collapsible open={showMusic} onOpenChange={setShowMusic}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center cursor-pointer">
                  <Music className="h-3.5 w-3.5" />
                  {showMusic ? "Hide Music Library" : "🎧 Choose Your Soundtrack"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={newLink.title}
                    onChange={(e) => setNewLink((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Title"
                    className="flex-1 text-xs"
                  />
                  <Input
                    value={newLink.url}
                    onChange={(e) => setNewLink((p) => ({ ...p, url: e.target.value }))}
                    placeholder="YouTube URL"
                    className="flex-1 text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={() => newLink.url && addLink.mutate()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {musicLinks && musicLinks.length > 0 && (
                  <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                    {musicLinks.map((link: any) => (
                      <div key={link.id} className="flex items-center gap-2 p-2 text-xs">
                        <span className="flex-1 truncate text-foreground">{link.title || "Untitled"}</span>
                        <a href={link.youtube_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button onClick={() => deleteLink.mutate(link.id)} className="text-destructive/60 hover:text-destructive cursor-pointer">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Button className="w-full" size="lg" onClick={startSession} disabled={!intention.trim() || !focusDomain || !focusArea}>
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
                <span className="text-xs text-muted-foreground mt-1">
                  {DOMAIN_LABELS[focusDomain] || focusDomain} • {totalDuration}m
                </span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground italic">"{intention}"</p>
              {selectedLesson && (
                <p className="text-xs text-primary">📖 {selectedLesson.lesson_title}</p>
              )}
              {focusDetail && !selectedLesson && (
                <p className="text-xs text-primary">{focusDetail}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="lg" onClick={() => setRunning(!running)}>
                {running ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                {running ? "Pause" : "Resume"}
              </Button>
              <Button variant="default" size="lg" onClick={endSession}>
                <Square className="mr-1 h-4 w-4" /> End Sprint
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={extendSession}>
              <Plus className="mr-1 h-3 w-3" /> Add 15 min to wrap up
            </Button>
          </CardContent>
        </Card>
      )}

      {/* REPORT PHASE */}
      {phase === "report" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Sprint Complete 🎯</h2>
              <p className="text-sm text-muted-foreground mt-1">Here's what happened</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="border rounded-md p-3">
                <p className="text-2xl font-bold text-foreground">{elapsedMinutes}m</p>
                <p className="text-xs text-muted-foreground">Time Spent</p>
              </div>
              <div className="border rounded-md p-3">
                <p className="text-2xl font-bold text-foreground">{activityLog.length}</p>
                <p className="text-xs text-muted-foreground">Actions Logged</p>
              </div>
            </div>

            {selectedLesson && (
              <div className="flex items-center gap-2 text-sm border rounded-md p-3 bg-muted/50">
                <span className="text-muted-foreground">Lesson:</span>
                <span className="font-medium text-foreground flex-1">{selectedLesson.lesson_title}</span>
                <Badge variant="outline" className="text-[10px]">{selectedLesson.lesson_status}</Badge>
                <Link to={`/lesson/${selectedLessonId}`} className="text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {activityLog.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity Log</p>
                <div className="border rounded-md divide-y">
                  {activityLog.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-2 p-2.5 text-xs">
                      <span className="shrink-0">{ACTION_LABELS[a.action_type] || a.action_type}</span>
                      {a.action_detail && <span className="text-muted-foreground flex-1">{a.action_detail}</span>}
                      <span className="text-muted-foreground/50 shrink-0">
                        {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activityLog.length === 0 && (
              <p className="text-xs text-muted-foreground text-center italic border rounded-md p-3">
                No actions tracked this session.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Additional notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="What did you accomplish?"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { clearSprintState(); resetAll(); }}>Skip</Button>
              <Button className="flex-1" onClick={submitReport}>Save Sprint Report</Button>
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
                  <Badge variant="outline" className="text-[10px] capitalize">{s.domain || s.focus_area}</Badge>
                  {s.focus_detail && <span className="truncate">{s.focus_detail}</span>}
                  {s.activityCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{s.activityCount} actions</Badge>
                  )}
                </div>
                {s.lesson && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">📖</span>
                    <span className="truncate text-foreground">{s.lesson.lesson_title}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{s.lesson.lesson_status}</Badge>
                    <Link to={`/lesson/${s.lesson_id}`} className="text-primary hover:underline shrink-0">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
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
  );
}
