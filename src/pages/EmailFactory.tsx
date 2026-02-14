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
} from "lucide-react";

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

export default function EmailFactory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  // Form state for creating
  const [newEmail, setNewEmail] = useState({
    title: "",
    email_type: "General",
    audience: "",
    purpose: "",
    giving: "",
    hoping_to_receive: "",
    local_flavor: "",
    semester: "Spring 2026",
  });

  // Active email being worked on
  const [editingId, setEditingId] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");

  // Fetch user prefs for email types and style guide
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

  const emailTypes = (prefs as any)?.email_types ?? DEFAULT_EMAIL_TYPES;
  const semesters = (prefs as any)?.semesters ?? DEFAULT_SEMESTERS;
  const emailStyleGuide = (prefs as any)?.email_style_guide ?? "";
  const maxRefinements = (prefs as any)?.email_max_refinements ?? 3;

  // Fetch all emails
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

  // Create email
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .insert({
          user_id: user!.id,
          ...newEmail,
          status: "planning",
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
        title: "",
        email_type: "General",
        audience: "",
        purpose: "",
        giving: "",
        hoping_to_receive: "",
        local_flavor: "",
        semester: "Spring 2026",
      });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  // Update email fields
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("emails")
        .update(updates)
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emails"] }),
  });

  // Save journal and move to journaling status
  const saveJournal = () => {
    if (!journalDraft.trim()) return;
    updateMutation.mutate({
      journal_body: journalDraft,
      status: "journaling",
    });
    toast.success("Journal saved!");
  };

  // AI Refinement
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

  // Finalize
  const finalize = () => {
    const draft = activeEmail?.ai_refined_body || activeEmail?.journal_body || "";
    updateMutation.mutate({
      final_draft: draft,
      status: "finalized",
    });
    toast.success("Email finalized!");
  };

  // Delete
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

  // When opening an email, load its journal
  const openEmail = (email: any) => {
    setEditingId(email.id);
    setJournalDraft(email.journal_body || "");
    setRefinementPrompt("");
  };

  const filteredEmails = activeTab === "all"
    ? emails
    : emails?.filter((e: any) => e.status === activeTab);

  const remainingPasses = activeEmail
    ? Math.max(0, maxRefinements - (activeEmail.refinement_count ?? 0))
    : 0;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Factory</h1>
          <p className="text-sm text-muted-foreground">
            Give more than you receive — craft authentic emails that connect
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Email
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar: Email List */}
        <div className="space-y-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
              <TabsTrigger value="planning" className="flex-1 text-xs">Plan</TabsTrigger>
              <TabsTrigger value="journaling" className="flex-1 text-xs">Draft</TabsTrigger>
              <TabsTrigger value="refining" className="flex-1 text-xs">Refine</TabsTrigger>
              <TabsTrigger value="finalized" className="flex-1 text-xs">Done</TabsTrigger>
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
                        </p>
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

        {/* Main Content: Active Email */}
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
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[activeEmail.status as EmailStatus] || ""}
                      >
                        {STATUS_LABELS[activeEmail.status as EmailStatus]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(activeEmail.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Purpose:</span>{" "}
                      <span className="text-foreground">{activeEmail.purpose || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Giving:</span>{" "}
                      <span className="text-foreground">{activeEmail.giving || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hoping to receive:</span>{" "}
                      <span className="text-foreground">{activeEmail.hoping_to_receive || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Local flavor:</span>{" "}
                      <span className="text-foreground">{activeEmail.local_flavor || "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Journal Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Journal Your Email
                  </CardTitle>
                  <CardDescription>
                    Write freely. This is 100% you — raw, authentic, human.
                  </CardDescription>
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
                    <Button variant="outline" onClick={saveJournal} disabled={!journalDraft.trim()}>
                      Save Draft
                    </Button>
                    {activeEmail.journal_body && activeEmail.refinement_count < maxRefinements && (
                      <Button
                        onClick={() => refineMutation.mutate()}
                        disabled={refineMutation.isPending}
                      >
                        <Sparkles className="mr-1 h-4 w-4" />
                        {activeEmail.refinement_count === 0
                          ? "Send to AI Editor"
                          : `Refine (${remainingPasses} left)`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Refined Version */}
              {activeEmail.ai_refined_body && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> AI-Edited Draft
                      <Badge variant="secondary" className="text-xs">
                        Pass {activeEmail.refinement_count}/{maxRefinements}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                      {activeEmail.ai_refined_body}
                    </div>

                    {/* Refinement input */}
                    {remainingPasses > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">Feedback for next pass:</Label>
                        <Textarea
                          value={refinementPrompt}
                          onChange={(e) => setRefinementPrompt(e.target.value)}
                          rows={3}
                          placeholder="Tell the AI what to adjust..."
                        />
                        <Button
                          onClick={() => refineMutation.mutate()}
                          disabled={!refinementPrompt.trim() || refineMutation.isPending}
                          size="sm"
                        >
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                          {refineMutation.isPending ? "Refining..." : `Refine (${remainingPasses} left)`}
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(activeEmail.ai_refined_body || "");
                          toast.success("Copied to clipboard!");
                        }}
                      >
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
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="h-4 w-4" /> Strategy Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                      {activeEmail.ai_strategy_notes}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Final Draft */}
              {activeEmail.final_draft && (
                <Card className="border-border bg-accent/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-4 w-4" /> Final Draft
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border bg-card p-4 text-sm whitespace-pre-wrap">
                      {activeEmail.final_draft}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(activeEmail.final_draft || "");
                          toast.success("Final draft copied!");
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy Final
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          updateMutation.mutate({ status: "sent" });
                          toast.success("Marked as sent!");
                        }}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Mark as Sent
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Email Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Email</DialogTitle>
            <DialogDescription>
              Plan your email — who it's for, what you're giving, what you hope to get back.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title / Subject</Label>
              <Input
                value={newEmail.title}
                onChange={(e) => setNewEmail((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Post-Exam 1 Check-in — ACCY 201"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email Type</Label>
                <Select
                  value={newEmail.email_type}
                  onValueChange={(v) => setNewEmail((p) => ({ ...p, email_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {emailTypes.map((t: string) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select
                  value={newEmail.semester}
                  onValueChange={(v) => setNewEmail((p) => ({ ...p, semester: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {semesters.map((s: string) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Who's it for?</Label>
              <Input
                value={newEmail.audience}
                onChange={(e) => setNewEmail((p) => ({ ...p, audience: e.target.value }))}
                placeholder="e.g. ACCY 201 students who just took Exam 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input
                value={newEmail.purpose}
                onChange={(e) => setNewEmail((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="e.g. Collect post-exam feedback and encourage engagement"
              />
            </div>
            <div className="space-y-1.5">
              <Label>What are you giving?</Label>
              <Input
                value={newEmail.giving}
                onChange={(e) => setNewEmail((p) => ({ ...p, giving: e.target.value }))}
                placeholder="e.g. $25 Venmo drawing, genuine care, study tips"
              />
            </div>
            <div className="space-y-1.5">
              <Label>What do you hope to receive?</Label>
              <Input
                value={newEmail.hoping_to_receive}
                onChange={(e) => setNewEmail((p) => ({ ...p, hoping_to_receive: e.target.value }))}
                placeholder="e.g. Honest exam feedback, question details, engagement"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Local Flavor / Ole Miss Touches</Label>
              <Input
                value={newEmail.local_flavor}
                onChange={(e) => setNewEmail((p) => ({ ...p, local_flavor: e.target.value }))}
                placeholder="e.g. Mention Tarasque, the Square, game day vibes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newEmail.title.trim() || createMutation.isPending}
            >
              <ArrowRight className="mr-1 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create & Start Writing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
