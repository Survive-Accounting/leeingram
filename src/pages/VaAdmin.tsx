import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  UserPlus, Users, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Activity, Loader2,
} from "lucide-react";
import type { VaAccount } from "@/hooks/useVaAccount";

export default function VaAdmin() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formCourseId, setFormCourseId] = useState("");
  const [formChapterId, setFormChapterId] = useState("");

  // Fetch data
  const { data: vaAccounts, isLoading } = useQuery({
    queryKey: ["va-accounts-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VaAccount[];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (error) throw error;
      return data;
    },
  });

  const filteredChapters = useMemo(
    () => (chapters ?? []).filter((ch) => ch.course_id === formCourseId),
    [chapters, formCourseId]
  );

  // Fetch activity counts per VA
  const { data: activityCounts } = useQuery({
    queryKey: ["va-activity-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_activity_log")
        .select("user_id, created_at");
      if (error) throw error;
      // Group by user
      const map = new Map<string, { count: number; timestamps: string[] }>();
      for (const row of data as any[]) {
        if (!map.has(row.user_id)) map.set(row.user_id, { count: 0, timestamps: [] });
        const entry = map.get(row.user_id)!;
        entry.count++;
        entry.timestamps.push(row.created_at);
      }
      return map;
    },
  });

  // Fetch pipeline counts per chapter
  const { data: chapterCounts } = useQuery({
    queryKey: ["va-chapter-pipeline-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("chapter_id, pipeline_status");
      if (error) throw error;
      const map = new Map<string, Record<string, number>>();
      for (const row of data as any[]) {
        if (!map.has(row.chapter_id)) map.set(row.chapter_id, {});
        const m = map.get(row.chapter_id)!;
        m[row.pipeline_status] = (m[row.pipeline_status] || 0) + 1;
      }
      return map;
    },
  });

  // Create VA account
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-va-user", {
        body: {
          email: formEmail,
          password: formPassword,
          full_name: formName,
          assigned_course_id: formCourseId || null,
          assigned_chapter_id: formChapterId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-accounts-admin"] });
      toast.success("VA test account created");
      setCreateOpen(false);
      setFormName(""); setFormEmail(""); setFormPassword(""); setFormCourseId(""); setFormChapterId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("va_accounts").update({ account_status: newStatus } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-accounts-admin"] });
      toast.success("Status updated");
    },
  });

  // Compute active time from activity log timestamps
  function computeSessionMetrics(timestamps: string[]) {
    if (timestamps.length === 0) return { activeMins: 0, idleMins: 0, elapsedMins: 0 };
    const sorted = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
    const SESSION_GAP = 15 * 60 * 1000; // 15 minutes
    let activeMs = 0;
    let sessionStart = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - prev;
      if (gap > SESSION_GAP) {
        activeMs += prev - sessionStart;
        sessionStart = sorted[i];
      }
      prev = sorted[i];
    }
    activeMs += prev - sessionStart;

    const elapsedMs = sorted[sorted.length - 1] - sorted[0];
    return {
      activeMins: Math.round(activeMs / 60000),
      idleMins: Math.round((elapsedMs - activeMs) / 60000),
      elapsedMins: Math.round(elapsedMs / 60000),
    };
  }

  function getChapterLabel(chapterId: string | null) {
    if (!chapterId || !chapters) return "—";
    const ch = chapters.find(c => c.id === chapterId);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "—";
  }

  function getCourseLabel(courseId: string | null) {
    if (!courseId || !courses) return "—";
    const c = courses.find(c => c.id === courseId);
    return c ? c.course_name : "—";
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> VA Test Accounts
            </h1>
            <p className="text-sm text-white/50 mt-0.5">
              {vaAccounts?.length ?? 0} accounts · Manage chapter assignments and track progress
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Create VA Account
          </Button>
        </div>

        {/* Account list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : !vaAccounts?.length ? (
          <div className="text-center py-16 text-white/40">
            No VA test accounts yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {vaAccounts.map((va) => {
              const activity = activityCounts?.get(va.user_id);
              const metrics = computeSessionMetrics(activity?.timestamps ?? []);
              const pipeline = va.assigned_chapter_id ? chapterCounts?.get(va.assigned_chapter_id) : null;
              const isExpanded = expandedId === va.id;

              return (
                <div
                  key={va.id}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                >
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : va.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{va.full_name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px]",
                            va.account_status === "active"
                              ? "border-emerald-500/40 text-emerald-400"
                              : "border-white/20 text-white/40"
                          )}
                        >
                          {va.account_status}
                        </Badge>
                        {va.completed_at && (
                          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">
                            ✓ Complete
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        {getCourseLabel(va.assigned_course_id)} · {getChapterLabel(va.assigned_chapter_id)}
                      </p>
                    </div>

                    {/* Quick metrics */}
                    <div className="hidden sm:flex items-center gap-5 text-xs text-white/50">
                      <div className="text-center">
                        <p className="text-white font-bold tabular-nums">{activity?.count ?? 0}</p>
                        <p className="text-[9px]">Actions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-bold tabular-nums">{metrics.activeMins}m</p>
                        <p className="text-[9px]">Active</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-bold tabular-nums">{metrics.elapsedMins}m</p>
                        <p className="text-[9px]">Elapsed</p>
                      </div>
                    </div>

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-white/40">Email</p>
                          <p className="text-white/80">{va.email}</p>
                        </div>
                        <div>
                          <p className="text-white/40">Assigned</p>
                          <p className="text-white/80">{formatTime(va.test_assigned_at)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">First Login</p>
                          <p className="text-white/80">{formatTime(va.first_login_at)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">First Action</p>
                          <p className="text-white/80">{formatTime(va.first_action_at)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">Last Action</p>
                          <p className="text-white/80">{formatTime(va.last_action_at)}</p>
                        </div>
                        <div>
                          <p className="text-white/40">Active Time</p>
                          <p className="text-white/80">{metrics.activeMins} min</p>
                        </div>
                        <div>
                          <p className="text-white/40">Idle Time</p>
                          <p className="text-white/80">{metrics.idleMins} min</p>
                        </div>
                        <div>
                          <p className="text-white/40">Completed</p>
                          <p className="text-white/80">{va.completed_at ? formatTime(va.completed_at) : "Not yet"}</p>
                        </div>
                      </div>

                      {/* Pipeline progress for assigned chapter */}
                      {pipeline && (
                        <div>
                          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Pipeline Progress</p>
                          <div className="flex gap-3 text-xs">
                            {["imported", "generated", "approved", "banked", "deployed"].map((s) => (
                              <div key={s} className="text-center">
                                <p className="text-white font-bold tabular-nums">{pipeline[s] ?? 0}</p>
                                <p className="text-[9px] text-white/40 capitalize">{s}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => toggleStatus.mutate({
                            id: va.id,
                            newStatus: va.account_status === "active" ? "inactive" : "active",
                          })}
                        >
                          {va.account_status === "active" ? (
                            <><XCircle className="h-3 w-3 mr-1" /> Deactivate</>
                          ) : (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Activate</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create VA Test Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="John King" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="john@example.com" type="email" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <Input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} type="password" placeholder="Minimum 6 characters" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assigned Course</Label>
              <Select value={formCourseId} onValueChange={(v) => { setFormCourseId(v); setFormChapterId(""); }}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select course…" /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assigned Chapter</Label>
              <Select value={formChapterId} onValueChange={setFormChapterId} disabled={!formCourseId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select chapter…" /></SelectTrigger>
                <SelectContent>
                  {filteredChapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formName || !formEmail || !formPassword || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
