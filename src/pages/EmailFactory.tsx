import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Mail,
  Send,
  Sparkles,
  FileText,
  ArrowRight,
  Trash2,
  Copy,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Link2,
  ChevronLeft,
} from "lucide-react";
import { Link } from "react-router-dom";

type EmailStatus = "planning" | "journaling" | "refining" | "finalized" | "sent";

const STATUS_LABELS: Record<EmailStatus, string> = {
  planning: "Planning",
  journaling: "Journaling",
  refining: "AI Refining",
  finalized: "Finalized",
  sent: "Sent",
};

const STATUS_STYLES: Record<EmailStatus, string> = {
  planning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  journaling: "bg-blue-100 text-blue-800 border-blue-200",
  refining: "bg-purple-100 text-purple-800 border-purple-200",
  finalized: "bg-green-100 text-green-800 border-green-200",
  sent: "bg-muted text-muted-foreground border-border",
};

const DEFAULT_EMAIL_TYPES = [
  "Post-Exam Feedback",
  "Welcome/Onboarding",
  "Course Update",
  "Promotion",
  "Thank You",
  "Re-engagement",
  "General",
];

const DEFAULT_SEMESTERS = ["Spring 2026", "Summer 2026", "Fall 2026", "Spring 2027"];

const SEND_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const WEEK_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);

export default function EmailFactory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const [newEmail, setNewEmail] = useState({
    title: "",
    email_type: "General",
    course_tags: [] as string[],
    audience: "",
    purpose: "",
    giving: "",
    hoping_to_receive: "",
    local_flavor: "",
    semester: "Spring 2026",
    is_series: false,
    series_name: "",
    send_day: "",
    send_time: "",
    send_week: undefined as number | undefined,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [finalDraftEdit, setFinalDraftEdit] = useState("");
  const [isEditingFinal, setIsEditingFinal] = useState(false);

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name, slug").order("course_name");
      if (error) throw error;
      return data;
    },
  });

  const emailTypes = (prefs as any)?.email_types ?? DEFAULT_EMAIL_TYPES;
  const semesters = (prefs as any)?.semesters ?? DEFAULT_SEMESTERS;
  const emailStyleGuide = (prefs as any)?.email_style_guide ?? "";
  const maxRefinements = (prefs as any)?.email_max_refinements ?? 3;

  const { data: emails, isLoading } = useQuery({
    queryKey: ["emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeEmail = emails?.find((e: any) => e.id === editingId);

  // Get related series emails
  const seriesEmails = activeEmail?.series_name
    ? emails?.filter((e: any) => e.series_name === activeEmail.series_name && e.id !== activeEmail.id)
    : [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const audienceStr = newEmail.course_tags.length > 0
        ? newEmail.course_tags.join(", ") + " students"
        : newEmail.audience || "All students";
      const { data, error } = await supabase
        .from("emails")
        .insert({
          user_id: user!.id,
          title: newEmail.title,
          email_type: newEmail.email_type,
          audience: audienceStr,
          course_tags: newEmail.course_tags,
          purpose: newEmail.purpose,
          giving: newEmail.giving,
          hoping_to_receive: newEmail.hoping_to_receive,
          local_flavor: newEmail.local_flavor,
          semester: newEmail.semester,
          status: "planning",
          is_series: newEmail.is_series,
          series_name: newEmail.series_name,
          send_day: newEmail.send_day,
          send_time: newEmail.send_time,
          send_week: newEmail.send_week ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success("Email created!");
      setShowCreate(false);
      setEditingId(data.id);
      setNewEmail({
        title: "", email_type: "General", course_tags: [], audience: "",
        purpose: "", giving: "", hoping_to_receive: "", local_flavor: "",
        semester: "Spring 2026", is_series: false, series_name: "",
        send_day: "", send_time: "", send_week: undefined,
      });
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
      const body = {
        journalBody: email.journal_body,
        emailType: email.email_type,
        audience: email.audience,
        purpose: email.purpose,
        giving: email.giving,
        hopingToReceive: email.hoping_to_receive,
        localFlavor: email.local_flavor,
        emailStyleGuide,
        refinementPrompt: isFirstPass ? undefined : refinementPrompt,
        previousDraft: isFirstPass ? undefined : (email.ai_refined_body || email.journal_body),
        passNumber: email.refinement_count + 1,
      };
      const { data, error } = await supabase.functions.invoke("refine-email", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      const email = activeEmail;
      const history = Array.isArray(email?.refinement_history) ? email.refinement_history : [];
      updateMutation.mutate({
        ai_refined_body: data.refinedEmail,
        ai_strategy_notes: data.strategyNotes,
        status: "refining",
        refinement_count: (email?.refinement_count ?? 0) + 1,
        refinement_history: [
          ...history,
          {
            pass: (email?.refinement_count ?? 0) + 1,
            prompt: refinementPrompt || "Initial refinement",
            result: data.refinedEmail,
            timestamp: new Date().toISOString(),
          },
        ],
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
    toast.success("Email finalized!");
  };

  const saveFinalEdit = () => {
    updateMutation.mutate({ final_draft: finalDraftEdit });
    setIsEditingFinal(false);
    toast.success("Final draft updated!");
  };

  const markAsSent = () => {
    updateMutation.mutate({ status: "sent", sent_at: new Date().toISOString() });
    toast.success("Marked as sent!");
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
  };

  const filteredEmails = activeTab === "all"
    ? emails
    : emails?.filter((e: any) => e.status === activeTab);

  const remainingPasses = activeEmail
    ? Math.max(0, maxRefinements - (activeEmail.refinement_count ?? 0))
    : 0;

  // Unique series names for suggestions
  const existingSeriesNames = [...new Set(emails?.map((e: any) => e.series_name).filter(Boolean) || [])];

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/marketing" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Factory</h1>
            <p className="text-sm text-muted-foreground">
              Give more than you receive — craft authentic emails that connect
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.surviveaccounting.com/author/mass_emails?tab=history"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              LearnWorlds
            </a>
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Email
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar */}
        <div className="space-y-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
              <TabsTrigger value="planning" className="flex-1 text-xs">Plan</TabsTrigger>
              <TabsTrigger value="journaling" className="flex-1 text-xs">Draft</TabsTrigger>
              <TabsTrigger value="refining" className="flex-1 text-xs">Refine</TabsTrigger>
              <TabsTrigger value="finalized" className="flex-1 text-xs">Done</TabsTrigger>
              <TabsTrigger value="sent" className="flex-1 text-xs">Sent</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !filteredEmails?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No emails yet. Create your first one!
            </p>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto">
              {filteredEmails.map((email: any) => (
                <Card
                  key={email.id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${editingId === email.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => openEmail(email)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">
                          {email.title || "Untitled Email"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {email.email_type} · {email.semester}
                          {email.series_name && ` · 📧 ${email.series_name}`}
                        </p>
                        {email.send_day && (
                          <p className="text-xs text-muted-foreground/70">
                            {email.send_day}{email.send_time ? ` @ ${email.send_time}` : ""}{email.send_week ? ` · Wk ${email.send_week}` : ""}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${STATUS_STYLES[email.status as EmailStatus] || ""}`}
                      >
                        {STATUS_LABELS[email.status as EmailStatus] || email.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div>
          {!activeEmail ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">Select an email or create a new one</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{activeEmail.title || "Untitled"}</CardTitle>
                      <CardDescription>
                        {activeEmail.email_type} · {activeEmail.audience} · {activeEmail.semester}
                      </CardDescription>
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
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Purpose:</span> <span className="text-foreground">{activeEmail.purpose || "—"}</span></div>
                    <div><span className="text-muted-foreground">Giving:</span> <span className="text-foreground">{activeEmail.giving || "—"}</span></div>
                    <div><span className="text-muted-foreground">Hoping to receive:</span> <span className="text-foreground">{activeEmail.hoping_to_receive || "—"}</span></div>
                    <div><span className="text-muted-foreground">Local flavor:</span> <span className="text-foreground">{activeEmail.local_flavor || "—"}</span></div>
                  </div>

                  {/* Scheduling info */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {activeEmail.is_series && activeEmail.series_name && (
                      <Badge variant="secondary"><Link2 className="mr-1 h-3 w-3" />{activeEmail.series_name}</Badge>
                    )}
                    {activeEmail.send_day && (
                      <Badge variant="outline"><Calendar className="mr-1 h-3 w-3" />{activeEmail.send_day}{activeEmail.send_time ? ` @ ${activeEmail.send_time}` : ""}</Badge>
                    )}
                    {activeEmail.send_week && (
                      <Badge variant="outline">Week {activeEmail.send_week}</Badge>
                    )}
                  </div>

                  {/* Inline scheduling editor */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Send Day</Label>
                      <Select
                        value={activeEmail.send_day || ""}
                        onValueChange={(v) => updateMutation.mutate({ send_day: v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Day" /></SelectTrigger>
                        <SelectContent>
                          {SEND_DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Send Time</Label>
                      <Input
                        type="time"
                        className="h-8 text-xs"
                        value={activeEmail.send_time || ""}
                        onChange={(e) => updateMutation.mutate({ send_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Week #</Label>
                      <Select
                        value={activeEmail.send_week?.toString() || ""}
                        onValueChange={(v) => updateMutation.mutate({ send_week: parseInt(v) })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Week" /></SelectTrigger>
                        <SelectContent>
                          {WEEK_OPTIONS.map((w) => <SelectItem key={w} value={w.toString()}>Week {w}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Series: Related Emails */}
              {seriesEmails && seriesEmails.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4" /> Series: {activeEmail.series_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {seriesEmails.map((se: any) => (
                      <div
                        key={se.id}
                        className="flex items-center justify-between rounded-md border p-2 text-sm cursor-pointer hover:bg-accent/50"
                        onClick={() => openEmail(se)}
                      >
                        <span className="truncate">{se.title || "Untitled"}</span>
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[se.status as EmailStatus] || ""}`}>
                          {STATUS_LABELS[se.status as EmailStatus]}
                        </Badge>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground pt-1">
                      💡 Suggested follow-ups: Recap, Thank You, Results Announcement
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Journal */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Journal Your Email
                  </CardTitle>
                  <CardDescription>Write freely. This is 100% you — raw, authentic, human.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={journalDraft}
                    onChange={(e) => setJournalDraft(e.target.value)}
                    rows={12}
                    placeholder="Start writing your email draft here. Be yourself. Be raw. Be human..."
                    className="font-mono text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={saveJournal} disabled={!journalDraft.trim()}>Save Draft</Button>
                    {activeEmail.journal_body && activeEmail.refinement_count < maxRefinements && (
                      <Button onClick={() => refineMutation.mutate()} disabled={refineMutation.isPending}>
                        <Sparkles className="mr-1 h-4 w-4" />
                        {activeEmail.refinement_count === 0 ? "Send to AI Editor" : `Refine (${remainingPasses} left)`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Refined */}
              {activeEmail.ai_refined_body && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> AI-Edited Draft
                      <Badge variant="secondary" className="text-xs">Pass {activeEmail.refinement_count}/{maxRefinements}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{activeEmail.ai_refined_body}</div>
                    {remainingPasses > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Feedback for next pass:</Label>
                        <Textarea value={refinementPrompt} onChange={(e) => setRefinementPrompt(e.target.value)} rows={3} placeholder="Tell the AI what to adjust..." />
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
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Finalize
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Strategy Notes */}
              {activeEmail.ai_strategy_notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Strategy Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{activeEmail.ai_strategy_notes}</div>
                  </CardContent>
                </Card>
              )}

              {/* Final Draft — Editable */}
              {activeEmail.final_draft && (
                <Card className="border-border bg-accent/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="h-4 w-4" /> Final Draft
                      </CardTitle>
                      {!isEditingFinal && activeEmail.status !== "sent" && (
                        <Button variant="ghost" size="sm" onClick={() => { setFinalDraftEdit(activeEmail.final_draft || ""); setIsEditingFinal(true); }}>
                          Edit
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isEditingFinal ? (
                      <>
                        <Textarea
                          value={finalDraftEdit}
                          onChange={(e) => setFinalDraftEdit(e.target.value)}
                          rows={14}
                          className="font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveFinalEdit}>Save Changes</Button>
                          <Button variant="outline" size="sm" onClick={() => setIsEditingFinal(false)}>Cancel</Button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md border bg-card p-4 text-sm whitespace-pre-wrap">{activeEmail.final_draft}</div>
                    )}

                    {!isEditingFinal && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(activeEmail.final_draft || ""); toast.success("Copied!"); }}>
                          <Copy className="mr-1 h-3.5 w-3.5" /> Copy Final
                        </Button>
                        {activeEmail.status === "finalized" && (
                          <>
                            <Button size="sm" asChild variant="outline">
                              <a href="https://www.surviveaccounting.com/author/mass_emails?tab=history" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open LearnWorlds
                              </a>
                            </Button>
                            <Button size="sm" onClick={markAsSent}>
                              <Send className="mr-1 h-3.5 w-3.5" /> Mark as Sent
                            </Button>
                          </>
                        )}
                        {activeEmail.status === "sent" && activeEmail.sent_at && (
                          <span className="text-xs text-muted-foreground self-center">
                            ✅ Sent {new Date(activeEmail.sent_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Email</DialogTitle>
            <DialogDescription>Plan your email — who it's for, what you're giving, what you hope to get back.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title / Subject</Label>
              <Input value={newEmail.title} onChange={(e) => setNewEmail((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Post-Exam 1 Check-in — ACCY 201" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email Type</Label>
                <Select value={newEmail.email_type} onValueChange={(v) => setNewEmail((p) => ({ ...p, email_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{emailTypes.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select value={newEmail.semester} onValueChange={(v) => setNewEmail((p) => ({ ...p, semester: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{semesters.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Who's it for? (select courses)</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {courses?.map((course: any) => (
                  <label key={course.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={newEmail.course_tags.includes(course.course_name)}
                      onCheckedChange={(checked) => {
                        setNewEmail((p) => ({
                          ...p,
                          course_tags: checked
                            ? [...p.course_tags, course.course_name]
                            : p.course_tags.filter((t) => t !== course.course_name),
                        }));
                      }}
                    />
                    <span>{course.course_name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Series toggle */}
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Switch checked={newEmail.is_series} onCheckedChange={(v) => setNewEmail((p) => ({ ...p, is_series: v }))} />
              <div>
                <Label className="text-sm">Part of a series?</Label>
                <p className="text-xs text-muted-foreground">Link this email to a recurring campaign</p>
              </div>
            </div>
            {newEmail.is_series && (
              <div className="space-y-1.5">
                <Label>Series Name</Label>
                <Input
                  value={newEmail.series_name}
                  onChange={(e) => setNewEmail((p) => ({ ...p, series_name: e.target.value }))}
                  placeholder="e.g. Post-Exam Giveaways"
                  list="series-suggestions"
                />
                <datalist id="series-suggestions">
                  {existingSeriesNames.map((s) => <option key={s as string} value={s as string} />)}
                </datalist>
              </div>
            )}

            {/* Scheduling */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Typical Send Day</Label>
                <Select value={newEmail.send_day} onValueChange={(v) => setNewEmail((p) => ({ ...p, send_day: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent>{SEND_DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send Time</Label>
                <Input type="time" className="h-9" value={newEmail.send_time} onChange={(e) => setNewEmail((p) => ({ ...p, send_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Week of Semester</Label>
                <Select value={newEmail.send_week?.toString() || ""} onValueChange={(v) => setNewEmail((p) => ({ ...p, send_week: v ? parseInt(v) : undefined }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Week" /></SelectTrigger>
                  <SelectContent>{WEEK_OPTIONS.map((w) => <SelectItem key={w} value={w.toString()}>Wk {w}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Purpose <span className="text-muted-foreground text-xs">(internal note)</span></Label>
              <Textarea value={newEmail.purpose} onChange={(e) => setNewEmail((p) => ({ ...p, purpose: e.target.value }))} placeholder="e.g. Collect post-exam feedback and encourage engagement" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>What are you giving? <span className="text-muted-foreground text-xs">(internal note)</span></Label>
              <Textarea value={newEmail.giving} onChange={(e) => setNewEmail((p) => ({ ...p, giving: e.target.value }))} placeholder="e.g. $25 Venmo drawing, genuine care, study tips" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>What do you hope to receive? <span className="text-muted-foreground text-xs">(internal note)</span></Label>
              <Textarea value={newEmail.hoping_to_receive} onChange={(e) => setNewEmail((p) => ({ ...p, hoping_to_receive: e.target.value }))} placeholder="e.g. Honest exam feedback, question details, engagement" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Local Flavor / Ole Miss Touches <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={newEmail.local_flavor} onChange={(e) => setNewEmail((p) => ({ ...p, local_flavor: e.target.value }))} placeholder="e.g. Mention Tarasque, the Square, game day vibes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newEmail.title.trim() || createMutation.isPending}>
              <ArrowRight className="mr-1 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create & Start Writing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
