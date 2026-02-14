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
import { Plus, Trash2, Lightbulb, Rocket, Clock, CheckCircle2, ArrowUpDown } from "lucide-react";

const CATEGORIES = [
  { value: "content", label: "Content Production" },
  { value: "marketing", label: "Marketing" },
  { value: "integrations", label: "Integrations" },
  { value: "platform", label: "Platform / Tools" },
  { value: "tracking", label: "Time & Focus Tracking" },
  { value: "scaling", label: "Scaling / New Domains" },
  { value: "general", label: "General" },
];

const PRIORITIES = [
  { value: "high", label: "🔴 High", style: "bg-red-100 text-red-800 border-red-200" },
  { value: "medium", label: "🟡 Medium", style: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "low", label: "🟢 Low", style: "bg-green-100 text-green-800 border-green-200" },
];

const STATUSES = [
  { value: "idea", label: "💡 Idea", style: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "planned", label: "📋 Planned", style: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "in_progress", label: "🚧 In Progress", style: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "done", label: "✅ Done", style: "bg-green-100 text-green-800 border-green-200" },
  { value: "deferred", label: "⏸ Deferred", style: "bg-muted text-muted-foreground border-border" },
];

const SEMESTERS = [
  "Spring 2026", "Summer 2026", "Fall 2026",
  "Spring 2027", "Summer 2027", "Fall 2027",
  "Spring 2028", "Summer 2028", "Fall 2028",
  "Spring 2029", "Summer 2029", "Fall 2029",
  "Spring 2030", "Summer 2030", "Fall 2030",
];

// Pre-populated seed ideas from the user's brainstorming
const SEED_IDEAS = [
  // Marketing
  { title: "Promo Video Factory", description: "Create a sub-factory within Marketing for planning promotional videos tied to email campaigns and exam feedback content.", category: "marketing", priority: "high", target_semester: "Summer 2026" },
  { title: "Email series templates library", description: "Build reusable email series templates (Post-Exam Giveaways, Welcome Sequences, Re-engagement) that auto-clone each semester.", category: "marketing", priority: "high", target_semester: "Spring 2026" },
  { title: "Semester email calendar view", description: "Visual calendar showing all planned emails by week, day, and time across the semester for scheduling optimization.", category: "marketing", priority: "medium", target_semester: "Summer 2026" },
  { title: "Summer & Winter email campaigns", description: "Design email strategies specifically for summer and winter break — retention, early bird promos, prep content.", category: "marketing", priority: "medium", target_semester: "Summer 2026" },
  // Content
  { title: "Exam feedback → video series pipeline", description: "Turn post-exam feedback emails into a recurring video series. Each exam generates a check-in email + a follow-up feedback video.", category: "content", priority: "high", target_semester: "Spring 2026" },
  { title: "Content drop scheduling system", description: "Pattern-based scheduling: Saturdays for post-exam check-ins, Sundays for content drops, flexible weekday slots for other content.", category: "content", priority: "medium", target_semester: "Fall 2026" },
  // Integrations
  { title: "Google Sheets API integration", description: "Connect to Google Sheets API to auto-generate lesson worksheets from templates instead of manual placeholder URLs.", category: "integrations", priority: "high", target_semester: "Summer 2026" },
  { title: "Mailgun email sending", description: "Send finalized emails directly from the platform via Mailgun instead of copy-pasting to LearnWorlds.", category: "integrations", priority: "medium", target_semester: "Fall 2026" },
  { title: "Vimeo transcript import", description: "Pull video transcripts from Vimeo to auto-generate lesson summaries and study guides.", category: "integrations", priority: "low", target_semester: "Spring 2027" },
  { title: "Descript automation", description: "Connect to Descript for automated video editing workflows — rough cut generation from outlines.", category: "integrations", priority: "low", target_semester: "Fall 2027" },
  { title: "LearnWorlds publishing API", description: "Publish lessons and content directly to LearnWorlds from the platform.", category: "integrations", priority: "medium", target_semester: "Spring 2027" },
  // Platform
  { title: "Work session timer & focus tracker", description: "Built-in Pomodoro-style timer for tracking work sessions. Log time spent on content creation, filming, editing.", category: "tracking", priority: "medium", target_semester: "Fall 2026" },
  { title: "Analytics dashboard", description: "Track content production velocity: lessons per week, emails sent, video output, time invested per course.", category: "platform", priority: "medium", target_semester: "Spring 2027" },
  { title: "Style guide editor (teaching & email)", description: "Rich editor for maintaining both the teaching style guide and email style guide with version history.", category: "platform", priority: "low", target_semester: "Summer 2026" },
  // Scaling
  { title: "Scale to Arts Entrepreneurship", description: "Adapt the content factory framework for a new domain: Arts Entrepreneurship courses. Same pipeline, different subject matter.", category: "scaling", priority: "low", target_semester: "Fall 2028" },
  { title: "Scale to QuickBooks training", description: "Expand into QuickBooks training content using the same lesson planning and video production pipeline.", category: "scaling", priority: "low", target_semester: "Spring 2029" },
  { title: "Multi-instructor support", description: "Allow other instructors to use the platform with their own courses, style guides, and email factories.", category: "scaling", priority: "low", target_semester: "Spring 2030" },
];

export default function FeatureRoadmap() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showSeed, setShowSeed] = useState(false);

  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    category: "general",
    priority: "medium",
    target_semester: "",
    status: "idea",
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["roadmap-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const { error } = await supabase.from("roadmap_items").insert({
        user_id: user!.id,
        ...item,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast.success("Added to roadmap!");
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("roadmap_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roadmap-items"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast.success("Removed from roadmap");
    },
  });

  const seedRoadmap = async () => {
    for (const idea of SEED_IDEAS) {
      await supabase.from("roadmap_items").insert({ user_id: user!.id, ...idea });
    }
    queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
    setShowSeed(false);
    toast.success(`${SEED_IDEAS.length} ideas added to your roadmap!`);
  };

  const handleCreate = () => {
    createMutation.mutate(newItem);
    setShowCreate(false);
    setNewItem({ title: "", description: "", category: "general", priority: "medium", target_semester: "", status: "idea" });
  };

  const filtered = activeCategory === "all" ? items : items?.filter((i: any) => i.category === activeCategory);

  // Group by status
  const grouped = STATUSES.map((s) => ({
    ...s,
    items: filtered?.filter((i: any) => i.status === s.value) || [],
  }));

  const priorityStyle = (p: string) => PRIORITIES.find((pr) => pr.value === p)?.style || "";
  const statusObj = (s: string) => STATUSES.find((st) => st.value === s);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Roadmap</h1>
          <p className="text-sm text-muted-foreground">
            Brainstorm, prioritize, and schedule your platform's future
          </p>
        </div>
        <div className="flex gap-2">
          {(!items || items.length === 0) && (
            <Button variant="outline" onClick={() => setShowSeed(true)}>
              <Lightbulb className="mr-1 h-4 w-4" /> Load Seed Ideas
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Idea
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value} className="text-xs">{c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !items?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No roadmap items yet.</p>
            <Button variant="outline" onClick={() => setShowSeed(true)}>
              <Lightbulb className="mr-1 h-4 w-4" /> Load brainstormed ideas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.filter((g) => g.items.length > 0).map((group) => (
            <div key={group.value}>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                {group.label}
                <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item: any) => (
                  <Card key={item.id} className="group">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-foreground leading-tight">{item.title}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={`text-xs ${priorityStyle(item.priority)}`}>
                          {PRIORITIES.find((p) => p.value === item.priority)?.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                        </Badge>
                        {item.target_semester && (
                          <Badge variant="secondary" className="text-xs">{item.target_semester}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <Select
                          value={item.status}
                          onValueChange={(v) => updateMutation.mutate({ id: item.id, updates: { status: v } })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select
                          value={item.priority}
                          onValueChange={(v) => updateMutation.mutate({ id: item.id, updates: { priority: v } })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select
                          value={item.target_semester || ""}
                          onValueChange={(v) => updateMutation.mutate({ id: item.id, updates: { target_semester: v } })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue placeholder="Semester" /></SelectTrigger>
                          <SelectContent>
                            {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => {
                          const msg = `Let's build the "${item.title}" feature. Here's the description: ${item.description || "No description provided."}`;
                          navigator.clipboard.writeText(msg);
                          toast.success("Copied prompt to clipboard — paste it in chat to start building!");
                        }}
                      >
                        <Rocket className="mr-1 h-3 w-3" /> Let's Build This
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Feature Idea</DialogTitle>
            <DialogDescription>Brainstorm a new feature for the roadmap.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newItem.title} onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Promo Video Factory" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="What does this feature do? Why is it valuable?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newItem.priority} onValueChange={(v) => setNewItem((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Semester</Label>
              <Select value={newItem.target_semester} onValueChange={(v) => setNewItem((p) => ({ ...p, target_semester: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a semester" /></SelectTrigger>
                <SelectContent>{SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newItem.title.trim()}>Add to Roadmap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed Confirmation Dialog */}
      <Dialog open={showSeed} onOpenChange={setShowSeed}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Load Brainstormed Ideas</DialogTitle>
            <DialogDescription>
              This will add {SEED_IDEAS.length} feature ideas from your previous brainstorming sessions. You can edit, reprioritize, or delete any of them afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1.5 text-sm">
            {SEED_IDEAS.map((idea, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <Badge variant="outline" className="text-xs shrink-0">{idea.category}</Badge>
                <span className="truncate">{idea.title}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeed(false)}>Cancel</Button>
            <Button onClick={seedRoadmap}>
              <Rocket className="mr-1 h-4 w-4" /> Load All {SEED_IDEAS.length} Ideas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
