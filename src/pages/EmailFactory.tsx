import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Plus, Mail, Send, Sparkles, FileText, ArrowRight, Trash2, Copy,
  CheckCircle2, ExternalLink, Calendar, Link2, ChevronLeft, ChevronDown, Code,
} from "lucide-react";
import { Link } from "react-router-dom";
import { addDays, startOfWeek, format, parse } from "date-fns";

type EmailStatus = "planning" | "journaling" | "refining" | "finalized" | "sent";

const STATUS_LABELS: Record<EmailStatus, string> = {
  planning: "Plan", journaling: "Journal", refining: "Refine", finalized: "Final", sent: "Sent",
};

const STATUS_STYLES: Record<EmailStatus, string> = {
  planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  journaling: "bg-blue-100 text-blue-800 border-blue-200",
  refining: "bg-purple-100 text-purple-800 border-purple-200",
  finalized: "bg-green-100 text-green-800 border-green-200",
  sent: "bg-muted text-muted-foreground border-border",
};

const DEFAULT_EMAIL_TYPES = [
  "Post-Exam Feedback", "Welcome/Onboarding", "Course Update",
  "Promotion", "Thank You", "Re-engagement", "General",
];

const DEFAULT_SEMESTERS = ["Spring 2026", "Summer 2026", "Fall 2026", "Spring 2027"];
const SEND_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEK_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);
const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

function calcSendDate(semesterStart: string | null | undefined, weekNum: number | null | undefined, sendDay: string | null | undefined): string | null {
  if (!semesterStart || !weekNum || !sendDay) return null;
  try {
    const start = new Date(semesterStart + "T00:00:00");
    const weekStart = startOfWeek(start, { weekStartsOn: 1 }); // Monday
    const targetWeekStart = addDays(weekStart, (weekNum - 1) * 7);
    const dayIdx = DAY_INDEX[sendDay];
    if (dayIdx === undefined) return null;
    const mondayBased = dayIdx === 0 ? 6 : dayIdx - 1;
    const result = addDays(targetWeekStart, mondayBased);
    return format(result, "yyyy-MM-dd");
  } catch { return null; }
}

export default function EmailFactory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"plan" | "journal" | "refine" | "finalize">("plan");
  const [journalDraft, setJournalDraft] = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [finalDraftEdit, setFinalDraftEdit] = useState("");
  const [isEditingFinal, setIsEditingFinal] = useState(false);
  const [showFinalizedDialog, setShowFinalizedDialog] = useState(false);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  const [newEmail, setNewEmail] = useState({
    title: "", email_type: "General", course_tags: [] as string[],
    semester: "Spring 2026", series_name: "", send_day: "",
    send_week: undefined as number | undefined,
  });

  // Semester dates
  const [semesterStart, setSemesterStart] = useState("");
  const [semesterEnd, setSemesterEnd] = useState("");

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences").select("*").eq("user_id", user!.id).maybeSingle();
      if (data) {
        setSemesterStart((data as any).semester_start_date || "");
        setSemesterEnd((data as any).semester_end_date || "");
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name, slug").order("course_name");
      if (error) throw error; return data;
    },
  });

  const emailTypes = (prefs as any)?.email_types ?? DEFAULT_EMAIL_TYPES;
  const semesters = (prefs as any)?.semesters ?? DEFAULT_SEMESTERS;
  const emailStyleGuide = (prefs as any)?.email_style_guide ?? "";
  const maxRefinements = 5;

  const { data: emails, isLoading } = useQuery({
    queryKey: ["emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("emails").select("*").order("updated_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const activeEmail = emails?.find((e: any) => e.id === editingId);

  // Group emails by series
  const emailsBySeries = useMemo(() => {
    if (!emails) return { series: {} as Record<string, any[]>, standalone: [] as any[] };
    const series: Record<string, any[]> = {};
    const standalone: any[] = [];
    emails.forEach((e: any) => {
      if (e.series_name) {
        if (!series[e.series_name]) series[e.series_name] = [];
        series[e.series_name].push(e);
      } else {
        standalone.push(e);
      }
    });
    return { series, standalone };
  }, [emails]);

  const saveSemesterDates = async () => {
    if (!user) return;
    const { error } = await supabase.from("user_preferences")
      .upsert({ user_id: user.id, semester_start_date: semesterStart || null, semester_end_date: semesterEnd || null } as any,
        { onConflict: "user_id" });
    if (error) toast.error("Failed to save dates");
    else toast.success("Semester dates saved!");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const sendDate = calcSendDate(semesterStart, newEmail.send_week, newEmail.send_day);
      const { data, error } = await supabase.from("emails").insert({
        user_id: user!.id, title: newEmail.title, email_type: newEmail.email_type,
        audience: newEmail.course_tags.length > 0 ? newEmail.course_tags.join(", ") + " students" : "All students",
        course_tags: newEmail.course_tags, semester: newEmail.semester, status: "planning",
        is_series: !!newEmail.series_name, series_name: newEmail.series_name || null,
        send_day: newEmail.send_day || null, send_week: newEmail.send_week ?? null,
        send_date: sendDate, max_refinements: 5,
      }).select().single();
      if (error) throw error; return data;
    },
    onSuccess: (data: any) => {
      toast.success("Email created!");
      setShowCreate(false);
      setEditingId(data.id);
      setActivePanel("journal");
      setJournalDraft("");
      setNewEmail({ title: "", email_type: "General", course_tags: [], semester: "Spring 2026", series_name: "", send_day: "", send_week: undefined });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("emails").update(updates).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emails"] }),
  });

  const saveJournal = () => {
    if (!journalDraft.trim()) return;
    updateMutation.mutate({ journal_body: journalDraft, status: "journaling" });
    toast.success("Journal saved!");
  };

  const refineMutation = useMutation({
    mutationFn: async () => {
      const email = activeEmail;
      if (!email) throw new Error("No email selected");
      const isFirstPass = email.refinement_count === 0;
      const { data, error } = await supabase.functions.invoke("refine-email", {
        body: {
          journalBody: email.journal_body, emailType: email.email_type,
          audience: email.audience, purpose: "", giving: "", hopingToReceive: "",
          localFlavor: "", emailStyleGuide,
          refinementPrompt: isFirstPass ? undefined : refinementPrompt,
          previousDraft: isFirstPass ? undefined : (email.ai_refined_body || email.journal_body),
          passNumber: email.refinement_count + 1,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      const email = activeEmail;
      const history = Array.isArray(email?.refinement_history) ? email.refinement_history : [];
      updateMutation.mutate({
        ai_refined_body: data.refinedEmail, ai_strategy_notes: data.strategyNotes,
        status: "refining", refinement_count: (email?.refinement_count ?? 0) + 1,
        refinement_history: [...history, {
          pass: (email?.refinement_count ?? 0) + 1,
          prompt: refinementPrompt || "Initial refinement",
          result: data.refinedEmail, timestamp: new Date().toISOString(),
        }],
      });
      setRefinementPrompt("");
      toast.success("Refinement complete!");
    },
    onError: (e) => toast.error("Refinement failed: " + e.message),
  });

  const finalize = () => {
    const draft = activeEmail?.ai_refined_body || activeEmail?.journal_body || "";
    updateMutation.mutate({ final_draft: draft, status: "finalized" });
    setFinalDraftEdit(draft);
    setActivePanel("finalize");
    toast.success("Email finalized!");
  };

  const saveFinalEdit = () => {
    updateMutation.mutate({ final_draft: finalDraftEdit });
    setIsEditingFinal(false);
    toast.success("Final draft updated!");
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email deleted");
      if (editingId) setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });

  const openEmail = (email: any) => {
    setEditingId(email.id);
    setJournalDraft(email.journal_body || "");
    setFinalDraftEdit(email.final_draft || "");
    setIsEditingFinal(false);
    setRefinementPrompt("");
    // Auto-select the right tab based on status
    if (email.status === "finalized" || email.status === "sent") setActivePanel("finalize");
    else if (email.status === "refining") setActivePanel("refine");
    else if (email.status === "journaling") setActivePanel("journal");
    else setActivePanel("plan");
  };

  const remainingPasses = activeEmail ? Math.max(0, maxRefinements - (activeEmail.refinement_count ?? 0)) : 0;
  const existingSeriesNames = [...new Set(emails?.map((e: any) => e.series_name).filter(Boolean) || [])];

  const toggleSeries = (name: string) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const computedSendDate = activeEmail ? calcSendDate(semesterStart, activeEmail.send_week, activeEmail.send_day) : null;

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/marketing" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Factory</h1>
            <p className="text-sm text-muted-foreground">Give more than you receive</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.surviveaccounting.com/author/mass_emails?tab=history" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> LearnWorlds
            </a>
          </Button>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Email
          </Button>
        </div>
      </div>

      {/* Semester Dates */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Semester Start</Label>
          <Input type="date" className="h-7 w-36 text-xs" value={semesterStart} onChange={(e) => setSemesterStart(e.target.value)} />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">End</Label>
          <Input type="date" className="h-7 w-36 text-xs" value={semesterEnd} onChange={(e) => setSemesterEnd(e.target.value)} />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={saveSemesterDates}>Save</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Series + Standalone */}
        <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
          {Object.entries(emailsBySeries.series).map(([seriesName, seriesEmails]) => (
            <Collapsible key={seriesName} open={expandedSeries.has(seriesName)} onOpenChange={() => toggleSeries(seriesName)}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-muted/50 hover:bg-accent/50 transition-colors cursor-pointer text-left">
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${expandedSeries.has(seriesName) ? "" : "-rotate-90"}`} />
                <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1 truncate">{seriesName}</span>
                <Badge variant="secondary" className="text-[10px]">{seriesEmails.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 pl-3 pt-1">
                  {seriesEmails.map((email: any) => (
                    <Card
                      key={email.id}
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${editingId === email.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => openEmail(email)}
                    >
                      <CardContent className="p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium truncate text-foreground">{email.title || "Untitled"}</p>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLES[email.status as EmailStatus] || ""}`}>
                            {STATUS_LABELS[email.status as EmailStatus]}
                          </Badge>
                        </div>
                        {email.send_week && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Wk {email.send_week}{email.send_day ? ` · ${email.send_day}` : ""}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {emailsBySeries.standalone.length > 0 && Object.keys(emailsBySeries.series).length > 0 && (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 pt-2">Standalone</div>
          )}
          {emailsBySeries.standalone.map((email: any) => (
            <Card
              key={email.id}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${editingId === email.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => openEmail(email)}
            >
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">{email.title || "Untitled"}</p>
                    <p className="text-[10px] text-muted-foreground">{email.email_type} · {email.semester}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLES[email.status as EmailStatus] || ""}`}>
                    {STATUS_LABELS[email.status as EmailStatus]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {!isLoading && (!emails || emails.length === 0) && (
            <p className="text-sm text-muted-foreground py-8 text-center">No emails yet. Create your first one!</p>
          )}
        </div>

        {/* Main Panel */}
        <div>
          {!activeEmail ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">Select an email or create a new one</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Email Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{activeEmail.title || "Untitled"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {activeEmail.email_type} · {activeEmail.semester}
                    {activeEmail.series_name && ` · 📧 ${activeEmail.series_name}`}
                    {computedSendDate && ` · 📅 ${computedSendDate}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_STYLES[activeEmail.status as EmailStatus] || ""}>
                    {STATUS_LABELS[activeEmail.status as EmailStatus]}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(activeEmail.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {/* Tab Toggles */}
              <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="plan" className="flex-1 text-xs">Plan</TabsTrigger>
                  <TabsTrigger value="journal" className="flex-1 text-xs">Journal</TabsTrigger>
                  <TabsTrigger value="refine" className="flex-1 text-xs">Refine</TabsTrigger>
                  <TabsTrigger value="finalize" className="flex-1 text-xs">Finalize</TabsTrigger>
                </TabsList>

                {/* PLAN TAB */}
                <TabsContent value="plan" className="space-y-3 mt-3">
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Title</Label>
                        <Input className="h-8 text-sm" value={activeEmail.title || ""} onChange={(e) => updateMutation.mutate({ title: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Email Type</Label>
                          <Select value={activeEmail.email_type} onValueChange={(v) => updateMutation.mutate({ email_type: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{emailTypes.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Semester</Label>
                          <Select value={activeEmail.semester} onValueChange={(v) => updateMutation.mutate({ semester: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{semesters.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Week #</Label>
                          <Select
                            value={activeEmail.send_week?.toString() || ""}
                            onValueChange={(v) => {
                              const week = parseInt(v);
                              const sendDate = calcSendDate(semesterStart, week, activeEmail.send_day);
                              updateMutation.mutate({ send_week: week, send_date: sendDate });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Week" /></SelectTrigger>
                            <SelectContent>{WEEK_OPTIONS.map((w) => <SelectItem key={w} value={w.toString()}>Week {w}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Send Day</Label>
                          <Select
                            value={activeEmail.send_day || ""}
                            onValueChange={(v) => {
                              const sendDate = calcSendDate(semesterStart, activeEmail.send_week, v);
                              updateMutation.mutate({ send_day: v, send_date: sendDate });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Day" /></SelectTrigger>
                            <SelectContent>{SEND_DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      {computedSendDate && (
                        <p className="text-xs text-primary font-medium">📅 Auto-calculated send date: {computedSendDate}</p>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Series Name</Label>
                        <Input
                          className="h-8 text-sm"
                          value={activeEmail.series_name || ""}
                          onChange={(e) => updateMutation.mutate({ series_name: e.target.value, is_series: !!e.target.value })}
                          placeholder="e.g. Post-Exam Check In"
                          list="series-suggestions-edit"
                        />
                        <datalist id="series-suggestions-edit">
                          {existingSeriesNames.map((s) => <option key={s as string} value={s as string} />)}
                        </datalist>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Course Audience</Label>
                        <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                          {courses?.map((course: any) => (
                            <label key={course.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox
                                checked={(activeEmail.course_tags || []).includes(course.course_name)}
                                onCheckedChange={(checked) => {
                                  const tags = activeEmail.course_tags || [];
                                  updateMutation.mutate({
                                    course_tags: checked ? [...tags, course.course_name] : tags.filter((t: string) => t !== course.course_name),
                                  });
                                }}
                              />
                              <span>{course.course_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* JOURNAL TAB */}
                <TabsContent value="journal" className="space-y-3 mt-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Journal Your Email
                      </CardTitle>
                      <CardDescription className="text-xs">Write freely. 100% you — raw, authentic, human.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={journalDraft}
                        onChange={(e) => setJournalDraft(e.target.value)}
                        rows={16}
                        placeholder="Start writing your email draft here..."
                        className="font-mono text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={saveJournal} disabled={!journalDraft.trim()}>Save Draft</Button>
                        {activeEmail.journal_body && activeEmail.refinement_count < maxRefinements && (
                          <Button size="sm" onClick={() => { refineMutation.mutate(); setActivePanel("refine"); }} disabled={refineMutation.isPending}>
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            {activeEmail.refinement_count === 0 ? "Send to AI Editor" : `Refine (${remainingPasses} left)`}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* REFINE TAB */}
                <TabsContent value="refine" className="space-y-3 mt-3">
                  {activeEmail.ai_refined_body ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> AI-Edited Draft
                          <Badge variant="secondary" className="text-xs">Pass {activeEmail.refinement_count}/{maxRefinements}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">{activeEmail.ai_refined_body}</div>
                        {remainingPasses > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs">Feedback for next pass:</Label>
                            <Textarea value={refinementPrompt} onChange={(e) => setRefinementPrompt(e.target.value)} rows={3} placeholder="Tell the AI what to adjust..." className="text-sm" />
                            <Button onClick={() => refineMutation.mutate()} disabled={!refinementPrompt.trim() || refineMutation.isPending} size="sm">
                              <Sparkles className="mr-1 h-3.5 w-3.5" />
                              {refineMutation.isPending ? "Refining..." : `Refine (${remainingPasses} left)`}
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(activeEmail.ai_refined_body || ""); toast.success("Copied!"); }}>
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                          </Button>
                          <Button size="sm" onClick={finalize}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve & Finalize
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No AI draft yet. Journal your email first, then send to AI Editor.</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Strategy Notes */}
                  {activeEmail.ai_strategy_notes && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Strategy Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">{activeEmail.ai_strategy_notes}</div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* FINALIZE TAB */}
                <TabsContent value="finalize" className="space-y-3 mt-3">
                  {activeEmail.final_draft ? (
                    <Card className="border-border bg-accent/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Final Draft
                          </CardTitle>
                          <div className="flex gap-1.5">
                            {!isEditingFinal && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setFinalDraftEdit(activeEmail.final_draft || ""); setIsEditingFinal(true); }}>
                                Edit
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowFinalizedDialog(true)}>
                              <Sparkles className="mr-1 h-3 w-3" /> AI Suggestions
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {isEditingFinal ? (
                          <>
                            <Textarea value={finalDraftEdit} onChange={(e) => setFinalDraftEdit(e.target.value)} rows={14} className="font-mono text-sm" />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveFinalEdit}>Save Changes</Button>
                              <Button variant="outline" size="sm" onClick={() => setIsEditingFinal(false)}>Cancel</Button>
                            </div>
                          </>
                        ) : (
                          <div className="rounded-md border bg-card p-4 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">{activeEmail.final_draft}</div>
                        )}

                        {!isEditingFinal && (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(activeEmail.final_draft || ""); toast.success("Copied!"); }}>
                              <Copy className="mr-1 h-3.5 w-3.5" /> Copy Text
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px;">${(activeEmail.final_draft || "").split("\n").map((p: string) => p.trim() ? `<p>${p}</p>` : "").join("")}</div>`;
                              navigator.clipboard.writeText(html);
                              toast.success("HTML copied!");
                            }}>
                              <Code className="mr-1 h-3.5 w-3.5" /> Copy HTML
                            </Button>
                            <Button size="sm" asChild variant="outline">
                              <a href="https://www.surviveaccounting.com/author/mass_emails?tab=history" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open LearnWorlds
                              </a>
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Approve your AI draft to finalize.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestions Dialog */}
      <Dialog open={showFinalizedDialog} onOpenChange={setShowFinalizedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📧 Email Suggestions</DialogTitle>
            <DialogDescription>AI-generated recommendations from strategy notes</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeEmail?.ai_strategy_notes ? (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">🏆 Top 5 Subject Lines</h3>
                  <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {extractSection(activeEmail.ai_strategy_notes, "Subject Line")}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">🎯 Top 5 CTAs</h3>
                  <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {extractSection(activeEmail.ai_strategy_notes, "CTA")}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">📅 Schedule Send Date</h3>
                  <p className="text-xs text-muted-foreground">
                    {computedSendDate
                      ? `Auto-calculated: ${computedSendDate} (Week ${activeEmail.send_week}, ${activeEmail.send_day})`
                      : "Set Week # and Send Day in the Plan tab to auto-calculate"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Run AI refinement first to get suggestions.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Email</DialogTitle>
            <DialogDescription>Create a new email — assign to a series or keep standalone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title / Subject</Label>
              <Input value={newEmail.title} onChange={(e) => setNewEmail((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Post-Exam 1 Check-in" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email Type</Label>
                <Select value={newEmail.email_type} onValueChange={(v) => setNewEmail((p) => ({ ...p, email_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{emailTypes.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Semester</Label>
                <Select value={newEmail.semester} onValueChange={(v) => setNewEmail((p) => ({ ...p, semester: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{semesters.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Series Name <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={newEmail.series_name} onChange={(e) => setNewEmail((p) => ({ ...p, series_name: e.target.value }))} placeholder="e.g. Post-Exam Check Ins" list="series-suggestions" />
              <datalist id="series-suggestions">
                {existingSeriesNames.map((s) => <option key={s as string} value={s as string} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Course Audience</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                {courses?.map((course: any) => (
                  <label key={course.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={newEmail.course_tags.includes(course.course_name)}
                      onCheckedChange={(checked) => {
                        setNewEmail((p) => ({
                          ...p,
                          course_tags: checked ? [...p.course_tags, course.course_name] : p.course_tags.filter((t) => t !== course.course_name),
                        }));
                      }}
                    />
                    <span>{course.course_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Week #</Label>
                <Select value={newEmail.send_week?.toString() || ""} onValueChange={(v) => setNewEmail((p) => ({ ...p, send_week: v ? parseInt(v) : undefined }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Week" /></SelectTrigger>
                  <SelectContent>{WEEK_OPTIONS.map((w) => <SelectItem key={w} value={w.toString()}>Wk {w}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send Day</Label>
                <Select value={newEmail.send_day} onValueChange={(v) => setNewEmail((p) => ({ ...p, send_day: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent>{SEND_DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newEmail.title.trim() || createMutation.isPending}>
              <ArrowRight className="mr-1 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function extractSection(notes: string, keyword: string): string {
  const lines = notes.split("\n");
  const startIdx = lines.findIndex((l) => l.toLowerCase().includes(keyword.toLowerCase()));
  if (startIdx === -1) return "Not found in strategy notes.";
  const result: string[] = [];
  for (let i = startIdx; i < Math.min(startIdx + 8, lines.length); i++) {
    result.push(lines[i]);
  }
  return result.join("\n").trim();
}
