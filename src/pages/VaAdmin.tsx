import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserPlus, Users, Loader2, XCircle, CheckCircle2, Plus, Trash2, Eye } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { VA_ROLE_LABELS } from "@/hooks/useVaAccount";
import type { VaAccount } from "@/hooks/useVaAccount";

const VA_ROLES = ["content_creation_va", "sheet_prep_va", "lead_va"];

export default function VaAdmin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { startImpersonating } = useImpersonation();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null); // va_account_id

  // Create form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("content_creation_va");

  // Assignment form
  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignChapterId, setAssignChapterId] = useState("");
  const [assignRole, setAssignRole] = useState("content_creation_va");

  // ── Data fetching ──
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

  const { data: allAssignments } = useQuery({
    queryKey: ["va-assignments-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("va_assignments").select("*").order("assigned_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name, code").order("created_at");
      return data ?? [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      return data ?? [];
    },
  });

  const filteredChapters = useMemo(
    () => chapters?.filter(ch => ch.course_id === assignCourseId) ?? [],
    [chapters, assignCourseId]
  );

  // Helpers
  const getAssignmentsFor = (vaId: string) => allAssignments?.filter(a => a.va_account_id === vaId) ?? [];
  const getChapter = (id: string) => chapters?.find(c => c.id === id);
  const getCourse = (id: string) => courses?.find(c => c.id === id);

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  // ── Create VA ──
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-va-user", {
        body: { email: formEmail, password: formPassword, full_name: formName, role: formRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-accounts-admin"] });
      toast.success("VA account created");
      setCreateOpen(false);
      setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("content_creation_va");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Toggle status ──
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

  // ── Update role ──
  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("va_accounts").update({ role } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-accounts-admin"] });
      toast.success("Role updated");
    },
  });

  // ── Add assignment ──
  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!assignOpen || !assignCourseId || !assignChapterId) return;
      const { error } = await supabase.from("va_assignments").insert({
        va_account_id: assignOpen,
        course_id: assignCourseId,
        chapter_id: assignChapterId,
        assigned_role: assignRole,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-assignments-all"] });
      toast.success("Chapter assigned");
      setAssignCourseId(""); setAssignChapterId(""); setAssignRole("content_creation_va");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Remove assignment ──
  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("va_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-assignments-all"] });
      toast.success("Assignment removed");
    },
  });

  return (
    <SurviveSidebarLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> VA Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {vaAccounts?.length ?? 0} accounts · Manage roles and chapter assignments
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Create VA Account
          </Button>
        </div>

        {/* Accounts Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : !vaAccounts?.length ? (
          <div className="text-center py-16 text-muted-foreground">No VA accounts yet.</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-xs">VA Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Assigned Chapters</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Last Active</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaAccounts.map((va) => {
                  const assignments = getAssignmentsFor(va.id);
                  return (
                    <TableRow key={va.id} className="text-xs">
                      <TableCell className="font-medium text-foreground">{va.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{va.email}</TableCell>
                      <TableCell>
                        <Select
                          value={va.role}
                          onValueChange={(role) => updateRole.mutate({ id: va.id, role })}
                        >
                          <SelectTrigger className="h-6 text-[10px] w-36 bg-transparent border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VA_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">{VA_ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignments.length === 0 && <span className="text-muted-foreground/50">None</span>}
                          {assignments.map((a: any) => {
                            const ch = getChapter(a.chapter_id);
                            const co = getCourse(a.course_id);
                            return (
                              <Badge key={a.id} variant="outline" className="text-[9px] gap-1">
                                {co?.code} Ch{ch?.chapter_number}
                                <span className="text-muted-foreground">({VA_ROLE_LABELS[a.assigned_role]?.split(" ")[0]})</span>
                                <button
                                  onClick={() => removeAssignment.mutate(a.id)}
                                  className="ml-0.5 text-destructive/60 hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })}
                          <button
                            onClick={() => { setAssignOpen(va.id); setAssignRole(va.role); }}
                            className="inline-flex items-center text-[9px] text-primary hover:text-primary/80"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[9px]",
                          va.account_status === "active"
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-border text-muted-foreground"
                        )}>
                          {va.account_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatTime(va.last_action_at)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => toggleStatus.mutate({
                            id: va.id,
                            newStatus: va.account_status === "active" ? "inactive" : "active",
                          })}
                        >
                          {va.account_status === "active" ? (
                            <><XCircle className="h-3 w-3 mr-1 text-destructive" /> Deactivate</>
                          ) : (
                            <><CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" /> Activate</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create VA Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create VA Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Jane Smith" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} type="email" placeholder="jane@example.com" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <Input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} type="password" placeholder="Min 6 characters" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VA_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{VA_ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!formName || !formEmail || !formPassword || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Chapter Dialog */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Chapter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Course</Label>
              <Select value={assignCourseId} onValueChange={(v) => { setAssignCourseId(v); setAssignChapterId(""); }}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select course…" /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chapter</Label>
              <Select value={assignChapterId} onValueChange={setAssignChapterId} disabled={!assignCourseId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select chapter…" /></SelectTrigger>
                <SelectContent>
                  {filteredChapters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assignment Role</Label>
              <Select value={assignRole} onValueChange={setAssignRole}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VA_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{VA_ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button onClick={() => addAssignment.mutate()} disabled={!assignCourseId || !assignChapterId || addAssignment.isPending}>
              {addAssignment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
