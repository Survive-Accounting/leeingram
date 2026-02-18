import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainLayout } from "@/components/DomainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  Plus, Filter, ChevronDown, GripVertical, Pencil, Trash2, Check, X,
  Link as LinkIcon, ExternalLink, CalendarIcon, Printer,
} from "lucide-react";

const TRIP_CATEGORIES = [
  { value: "immigration", label: "Immigration & Residency" },
  { value: "selling", label: "Selling & Downsizing" },
  { value: "packing", label: "Packing & Storage" },
  { value: "drive", label: "Drive to Mexico Plan" },
  { value: "vehicle", label: "Vehicle Preparation" },
  { value: "pet", label: "Pet Preparation" },
  { value: "wind_down", label: "U.S. Life Wind-Down" },
  { value: "healthcare", label: "Healthcare & Insurance" },
  { value: "arrival", label: "Arrival & First 30 Days" },
  { value: "financial", label: "Mexico Financial Setup" },
];

const ASSIGNEES = [
  { value: "unassigned", label: "Unassigned" },
  { value: "lee", label: "Lee" },
  { value: "mk", label: "MK" },
  { value: "both", label: "Both" },
];

const TASK_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const COLUMNS = [
  { id: "all", label: "All To Do's" },
  { id: "unassigned", label: "Unassigned" },
  { id: "lee", label: "Lee" },
  { id: "mk", label: "MK" },
];

// ─── Sortable Task Card ───
function TaskCard({ task, onEdit, onDelete, isDragOverlay, showAllBadges }: {
  task: any; onEdit: (t: any) => void; onDelete: (id: string) => void; isDragOverlay?: boolean; showAllBadges?: boolean;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: isDragOverlay });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  const catLabel = TRIP_CATEGORIES.find(c => c.value === task.category)?.label || task.category;
  const statusLabel = TASK_STATUSES.find(s => s.value === task.status)?.label || task.status;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group border-border/80 bg-card hover:border-border transition-colors">
        <div className="p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium text-foreground leading-tight truncate flex-1">{task.title}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(task)}>
                <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(task.id)}>
                <Trash2 className="h-2.5 w-2.5 text-destructive" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 pl-5">
            {showAllBadges && <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight">{catLabel}</Badge>}
            {task.target_date && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight">
                <CalendarIcon className="h-2 w-2 mr-0.5" />{format(new Date(task.target_date + "T00:00:00"), "MMM d")}
              </Badge>
            )}
            {showAllBadges && task.assigned_to !== "both" && task.assigned_to !== "unassigned" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight bg-primary/10">{task.assigned_to === "lee" ? "Lee" : "MK"}</Badge>
            )}
          </div>
          {/* Selling extras */}
          {task.category === "selling" && (
            <div className="flex items-center gap-2 pl-5">
              {task.is_listed && <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/30">Listed</Badge>}
              {task.is_sold && <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Sold{task.sold_price ? ` $${task.sold_price}` : ""}</Badge>}
            </div>
          )}
          {/* Links */}
          {task.links && task.links.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-5">
              {task.links.map((link: any) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline">
                  <ExternalLink className="h-2 w-2" />{link.label || "Link"}
                </a>
              ))}
            </div>
          )}
          {/* Description toggle */}
          {task.description && (
            <Collapsible open={descOpen} onOpenChange={setDescOpen}>
              <CollapsibleTrigger asChild>
                <button className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5 pl-5">
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${descOpen ? "rotate-180" : ""}`} />
                  {descOpen ? "Hide details" : "View Description"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-[10px] text-muted-foreground mt-0.5 pl-5 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Droppable Column ───
function PlanColumn({ id, label, tasks, onEdit, onDelete, groupByCategory, showAllBadges }: {
  id: string; label: string; tasks: any[]; onEdit: (t: any) => void; onDelete: (id: string) => void; groupByCategory?: boolean; showAllBadges?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });
  const isAssigned = id === "lee" || id === "mk";

  const headerStyles = isAssigned
    ? "bg-amber-500/20 border-amber-500/40"
    : "bg-background/80 border-border";

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const g: Record<string, any[]> = {};
    for (const t of tasks) {
      const cat = t.category || "general";
      if (!g[cat]) g[cat] = [];
      g[cat].push(t);
    }
    return g;
  }, [tasks, groupByCategory]);

  return (
    <div ref={setNodeRef} className={`rounded-xl border p-3 ${headerStyles} flex flex-col min-h-[200px]`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {grouped ? (
          <div className="space-y-3 flex-1">
            {TRIP_CATEGORIES.map(cat => {
              const items = grouped[cat.value];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat.value}>
                  <div className="text-[10px] font-medium text-muted-foreground mb-1 px-1 uppercase tracking-wider">{cat.label}</div>
                  <div className="space-y-2">
                    {items.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} showAllBadges={showAllBadges} />)}
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && <p className="text-xs text-muted-foreground/60 text-center py-6">No items</p>}
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-6">No items</p>
            ) : (
              tasks.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} showAllBadges={showAllBadges} />)
            )}
          </div>
        )}
      </SortableContext>
    </div>
  );
}

// ─── Main Page ───
export default function TripPlanning() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [showDueDateManager, setShowDueDateManager] = useState(false);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);

  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterDate, setFilterDate] = useState<string | undefined>(undefined);

  // Form
  const emptyForm = { title: "", description: "", category: "immigration", assigned_to: "unassigned", target_date: undefined as Date | undefined, status: "todo", is_listed: false, is_sold: false, sold_price: "", links: [] as { url: string; label: string }[] };
  const [form, setForm] = useState(emptyForm);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch trip
  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").eq("id", tripId!).single();
      return data;
    },
    enabled: !!tripId,
  });

  // Fetch tasks with links
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["trip-tasks", tripId],
    queryFn: async () => {
      const { data: taskData } = await supabase
        .from("trip_tasks")
        .select("*")
        .eq("trip_id", tripId!)
        .order("target_date", { ascending: true, nullsFirst: false });
      if (!taskData || taskData.length === 0) return [];
      const taskIds = taskData.map(t => t.id);
      const { data: linkData } = await supabase
        .from("trip_task_links")
        .select("*")
        .in("task_id", taskIds);
      const linkMap: Record<string, any[]> = {};
      for (const l of (linkData || [])) {
        if (!linkMap[l.task_id]) linkMap[l.task_id] = [];
        linkMap[l.task_id].push(l);
      }
      return taskData.map(t => ({ ...t, links: linkMap[t.id] || [] }));
    },
    enabled: !!tripId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: newTask, error } = await supabase.from("trip_tasks").insert({
        trip_id: tripId!, user_id: user!.id, title: form.title, description: form.description,
        category: form.category, assigned_to: form.assigned_to,
        target_date: form.target_date ? format(form.target_date, "yyyy-MM-dd") : null,
        status: form.status,
        is_listed: form.category === "selling" ? form.is_listed : false,
        is_sold: form.category === "selling" ? form.is_sold : false,
        sold_price: form.category === "selling" && form.is_sold && form.sold_price ? parseFloat(form.sold_price) : null,
      }).select().single();
      if (error) throw error;
      // Insert links
      if (form.links.length > 0) {
        const linksToInsert = form.links.filter(l => l.url.trim()).map(l => ({ task_id: newTask.id, user_id: user!.id, url: l.url, label: l.label }));
        if (linksToInsert.length) await supabase.from("trip_task_links").insert(linksToInsert);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] }); resetForm(); toast.success("Task added!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTask) return;
      const { error } = await supabase.from("trip_tasks").update({
        title: form.title, description: form.description, category: form.category,
        assigned_to: form.assigned_to,
        target_date: form.target_date ? format(form.target_date, "yyyy-MM-dd") : null,
        status: form.status,
        is_listed: form.category === "selling" ? form.is_listed : false,
        is_sold: form.category === "selling" ? form.is_sold : false,
        sold_price: form.category === "selling" && form.is_sold && form.sold_price ? parseFloat(form.sold_price) : null,
      }).eq("id", editingTask.id);
      if (error) throw error;
      // Replace links
      await supabase.from("trip_task_links").delete().eq("task_id", editingTask.id);
      const linksToInsert = form.links.filter(l => l.url.trim()).map(l => ({ task_id: editingTask.id, user_id: user!.id, url: l.url, label: l.label }));
      if (linksToInsert.length) await supabase.from("trip_task_links").insert(linksToInsert);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] }); resetForm(); toast.success("Task updated!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("trip_tasks").delete().eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] }); toast.success("Deleted"); },
  });

  const quickUpdate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      await supabase.from("trip_tasks").update(updates).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] }),
  });

  const resetForm = () => { setForm(emptyForm); setEditingTask(null); setShowCreate(false); };

  const startEdit = (task: any) => {
    setEditingTask(task);
    setForm({
      title: task.title, description: task.description || "", category: task.category,
      assigned_to: task.assigned_to, target_date: task.target_date ? new Date(task.target_date + "T00:00:00") : undefined,
      status: task.status, is_listed: task.is_listed || false, is_sold: task.is_sold || false,
      sold_price: task.sold_price ? String(task.sold_price) : "",
      links: task.links?.map((l: any) => ({ url: l.url, label: l.label })) || [],
    });
    setShowCreate(true);
  };

  // Collect unique due dates from tasks, sorted soonest first
  const presetDueDates = useMemo(() => {
    if (!tasks) return [];
    const dates = new Set<string>();
    for (const t of tasks) {
      if (t.target_date) dates.add(t.target_date);
    }
    return Array.from(dates).sort();
  }, [tasks]);

  // Filtered tasks
  const filtered = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
      if (filterDate) {
        if (!t.target_date) return false;
        if (t.target_date !== filterDate) return false;
      }
      return true;
    });
  }, [tasks, filterCategory, filterAssignee, filterDate]);

  // Column data
  const allTodos = filtered;
  const unassignedTasks = filtered.filter(t => t.assigned_to === "unassigned" || t.assigned_to === "both");
  const leeTasks = filtered.filter(t => t.assigned_to === "lee");
  const mkTasks = filtered.filter(t => t.assigned_to === "mk");

  // Drag
  const handleDragStart = (e: DragStartEvent) => {
    const item = filtered.find(t => t.id === e.active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    // Dropped on column
    const colMap: Record<string, string> = { all: "both", unassigned: "unassigned", lee: "lee", mk: "mk" };
    if (colMap[overId] !== undefined) {
      const task = filtered.find(t => t.id === activeId);
      if (task && task.assigned_to !== colMap[overId]) {
        quickUpdate.mutate({ id: activeId, updates: { assigned_to: colMap[overId] } });
      }
      return;
    }
    // Dropped on another card — assign to that card's column
    const overTask = filtered.find(t => t.id === overId);
    const activeTask = filtered.find(t => t.id === activeId);
    if (overTask && activeTask && overTask.assigned_to !== activeTask.assigned_to) {
      quickUpdate.mutate({ id: activeId, updates: { assigned_to: overTask.assigned_to } });
    }
  };

  const hasFilters = filterCategory !== "all" || filterAssignee !== "all" || !!filterDate;

  return (
    <DomainLayout
      title={trip?.location ? `${trip.location} — Planning` : "Trip Planning"}
      tagline="Organize your move"
      actions={
        <div className="flex gap-2">
         <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowDueDateManager(true)}>
            <CalendarIcon className="mr-1 h-3.5 w-3.5" /> Set Due Dates
          </Button>
          <Button size="sm" variant="outline" disabled className="text-white/40 border-white/20">
            <Printer className="mr-1 h-3.5 w-3.5" /> Print View (Coming Soon)
          </Button>
          <Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Task
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-white/50" />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs w-[180px] bg-white/5 border-white/20 text-white"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {TRIP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 text-xs w-[120px] bg-white/5 border-white/20 text-white"><SelectValue placeholder="Person" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {ASSIGNEES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDate || "all"} onValueChange={v => setFilterDate(v === "all" ? undefined : v)}>
          <SelectTrigger className={cn("h-8 text-xs w-[160px] bg-white/5 border-white/20 text-white", filterDate && "border-primary")}>
            <CalendarIcon className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Due Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            {presetDueDates.map(d => (
              <SelectItem key={d} value={d}>{format(new Date(d + "T00:00:00"), "MMM d, yyyy")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-white/60 hover:text-white" onClick={() => { setFilterCategory("all"); setFilterAssignee("all"); setFilterDate(undefined); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Board */}
      {isLoading ? (
        <p className="text-white/50 text-sm">Loading...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <PlanColumn id="all" label="All To Do's" tasks={allTodos} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} groupByCategory showAllBadges />
            <PlanColumn id="unassigned" label="Unassigned" tasks={unassignedTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} />
            <PlanColumn id="lee" label="Lee" tasks={leeTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} />
            <PlanColumn id="mk" label="MK" tasks={mkTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} />
          </div>
          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <div className="opacity-90 rotate-2 scale-105 pointer-events-none">
                <TaskCard task={activeItem} onEdit={() => {}} onDelete={() => {}} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) resetForm(); else setShowCreate(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Details..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned To</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSIGNEES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                {presetDueDates.length > 0 ? (
                  <Select
                    value={form.target_date ? format(form.target_date, "yyyy-MM-dd") : "none"}
                    onValueChange={v => setForm(p => ({ ...p, target_date: v === "none" ? undefined : new Date(v + "T00:00:00") }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose due date" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No due date</SelectItem>
                      {presetDueDates.map(d => (
                        <SelectItem key={d} value={d}>{format(new Date(d + "T00:00:00"), "MMM d, yyyy")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.target_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.target_date ? format(form.target_date, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.target_date} onSelect={d => setForm(p => ({ ...p, target_date: d }))} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {/* Selling extras */}
            {form.category === "selling" && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground">Selling & Downsizing Fields</p>
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Listed?</Label>
                  <Switch checked={form.is_listed} onCheckedChange={v => setForm(p => ({ ...p, is_listed: v }))} />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Sold?</Label>
                  <Switch checked={form.is_sold} onCheckedChange={v => setForm(p => ({ ...p, is_sold: v }))} />
                </div>
                {form.is_sold && (
                  <div>
                    <Label className="text-xs">Sold Price ($)</Label>
                    <Input type="number" value={form.sold_price} onChange={e => setForm(p => ({ ...p, sold_price: e.target.value }))} placeholder="0.00" />
                  </div>
                )}
              </div>
            )}

            {/* Links */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Relevant Links</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setForm(p => ({ ...p, links: [...p.links, { url: "", label: "" }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Add Link
                </Button>
              </div>
              {form.links.map((link, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input value={link.label} onChange={e => { const links = [...form.links]; links[i].label = e.target.value; setForm(p => ({ ...p, links })); }} placeholder="Label (e.g. Car Insurance)" className="h-7 text-xs" />
                    <Input value={link.url} onChange={e => { const links = [...form.links]; links[i].url = e.target.value; setForm(p => ({ ...p, links })); }} placeholder="https://..." className="h-7 text-xs" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setForm(p => ({ ...p, links: p.links.filter((_, j) => j !== i) }))}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {editingTask ? (
              <Button onClick={() => form.title && updateMutation.mutate()} disabled={!form.title || updateMutation.isPending} className="w-full">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => form.title && createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Adding..." : "Add Task"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Due Dates Dialog */}
      <Dialog open={showDueDateManager} onOpenChange={setShowDueDateManager}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Set Due Dates</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Add milestone dates, then assign them to tasks using the due date dropdown.</p>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              {presetDueDates.map(d => (
                <div key={d} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <span className="text-sm">{format(new Date(d + "T00:00:00"), "MMMM d, yyyy")}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {tasks?.filter(t => t.target_date === d).length || 0} tasks
                  </Badge>
                </div>
              ))}
              {presetDueDates.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No due dates set yet</p>}
            </div>
            <div className="border-t pt-3">
              <Label className="text-xs mb-1 block">Add a new due date</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !newDueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {newDueDate ? format(newDueDate, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newDueDate} onSelect={setNewDueDate} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Button size="sm" disabled={!newDueDate || !user} onClick={async () => {
                  if (!newDueDate || !user) return;
                  const dateStr = format(newDueDate, "yyyy-MM-dd");
                  // Create a placeholder task to register this date
                  await supabase.from("trip_tasks").insert({
                    trip_id: tripId!, user_id: user.id, title: `[Due Date Milestone] ${format(newDueDate, "MMM d")}`,
                    category: "general", assigned_to: "unassigned", status: "todo",
                    target_date: dateStr, description: "Milestone date marker — assign tasks to this date.",
                  });
                  queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] });
                  setNewDueDate(undefined);
                  toast.success("Due date added!");
                }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DomainLayout>
  );
}
