import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainLayout } from "@/components/DomainLayout";
import holboxBg from "@/assets/holbox-beach-bg.jpg";
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
  DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import canvasConfetti from "canvas-confetti";
import {
  Plus, Filter, ChevronDown, GripVertical, Pencil, Trash2, Check, X,
  Link as LinkIcon, ExternalLink, CalendarIcon, Printer, ArrowRight, PartyPopper,
  Eye, EyeOff,
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
  { value: "unassigned", label: "To Assign" },
  { value: "lee", label: "Lee" },
  { value: "mk", label: "MK" },
  { value: "both", label: "Both" },
];

const TASK_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

// Column flow order for the arrow advance button
const COLUMN_FLOW = ["todo", "unassigned", "lee", "mk"];

const COLUMNS = [
  { id: "all", label: "To Do's" },
  { id: "unassigned", label: "To Assign" },
  { id: "lee", label: "Lee" },
  { id: "mk", label: "MK" },
];

// ─── Sortable Task Card ───
function TaskCard({ task, onEdit, onDelete, onAdvance, onMarkDone, isDragOverlay, showAllBadges, columnId }: {
  task: any; onEdit: (t: any) => void; onDelete: (id: string) => void; onAdvance?: (t: any) => void; onMarkDone?: (t: any) => void; isDragOverlay?: boolean; showAllBadges?: boolean; columnId?: string;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: isDragOverlay });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  const catLabel = TRIP_CATEGORIES.find(c => c.value === task.category)?.label || task.category;

  const isAssignedColumn = columnId === "lee" || columnId === "mk";
  const canAdvance = columnId !== "lee" && columnId !== "mk" && !isDragOverlay;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group border-border/80 bg-card hover:border-border transition-colors">
        <div className="p-2.5 space-y-1">
          <div className="flex items-start gap-1.5">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0 mt-0.5">
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium text-foreground leading-tight flex-1">{task.title}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              {canAdvance && onAdvance && (
                <Button variant="ghost" size="icon" className="h-5 w-5 text-primary hover:text-primary hover:bg-primary/10" onClick={() => onAdvance(task)} title="Move to next column">
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              {isAssignedColumn && onMarkDone && (
                <Button variant="ghost" size="icon" className="h-5 w-5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => onMarkDone(task)} title="Mark done">
                  <Check className="h-3 w-3" />
                </Button>
              )}
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
              {task.sold_price && !task.is_sold && <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight text-muted-foreground">${task.sold_price}</Badge>}
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
                  {descOpen ? "Hide Description" : "Show Description"}
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
function PlanColumn({ id, label, tasks, onEdit, onDelete, onAdvance, onMarkDone, groupByCategory, showAllBadges, headerExtra }: {
  id: string; label: string; tasks: any[]; onEdit: (t: any) => void; onDelete: (id: string) => void; onAdvance?: (t: any) => void; onMarkDone?: (t: any) => void; groupByCategory?: boolean; showAllBadges?: boolean; headerExtra?: React.ReactNode;
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
        <h2 className={cn("text-sm font-semibold", isAssigned ? "text-white" : "text-foreground")}>{label}</h2>
        <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        {headerExtra}
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
                    {items.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} onAdvance={onAdvance} onMarkDone={onMarkDone} showAllBadges={showAllBadges} columnId={id} />)}
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
              tasks.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} onAdvance={onAdvance} onMarkDone={onMarkDone} showAllBadges={showAllBadges} columnId={id} />)
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

  // View mode: "all" shows all 3 columns, "review" hides To Assign
  const [viewMode, setViewMode] = useState<"all" | "review">("review");

  // Bulk add selling
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkItems, setBulkItems] = useState<{ title: string; price: string }[]>([{ title: "", price: "" }]);

  // Celebration dialog
  const [celebrateTask, setCelebrateTask] = useState<any>(null);

  // Show completed modals
  const [showLeeCompleted, setShowLeeCompleted] = useState(false);
  const [showMkCompleted, setShowMkCompleted] = useState(false);

  // Print dialog
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printCategory, setPrintCategory] = useState("all");
  const [printAssignee, setPrintAssignee] = useState("all");
  const [printDate, setPrintDate] = useState<string | undefined>(undefined);

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
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
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

  // Advance a task to the next column
  const advanceTask = (task: any) => {
    const currentAssigned = task.assigned_to;
    // Flow: all(both) -> unassigned -> lee (default next)
    // "both" or items in "all" column go to unassigned
    if (currentAssigned === "both") {
      quickUpdate.mutate({ id: task.id, updates: { assigned_to: "unassigned" } });
    } else if (currentAssigned === "unassigned") {
      quickUpdate.mutate({ id: task.id, updates: { assigned_to: "lee" } });
    }
    // lee/mk don't advance, they have "done" button instead
  };

  // Mark task as done with celebration
  const handleMarkDone = (task: any) => {
    setCelebrateTask(task);
    // Fire confetti!
    canvasConfetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"],
    });
  };

  const confirmDone = () => {
    if (!celebrateTask) return;
    quickUpdate.mutate({ id: celebrateTask.id, updates: { status: "done", completed_at: new Date().toISOString() } });
    setCelebrateTask(null);
    toast.success("¡Completado!");
  };

  const cancelDone = () => {
    setCelebrateTask(null);
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

  // Filtered tasks (exclude done)
  const filtered = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => {
      if (t.status === "done") return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
      if (filterDate) {
        if (!t.target_date) return false;
        if (t.target_date !== filterDate) return false;
      }
      return true;
    });
  }, [tasks, filterCategory, filterAssignee, filterDate]);

  // Completed tasks for modals
  const completedLee = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.status === "done" && t.assigned_to === "lee").sort((a, b) => {
      const da = a.completed_at || a.updated_at;
      const db = b.completed_at || b.updated_at;
      return new Date(db).getTime() - new Date(da).getTime();
    });
  }, [tasks]);

  const completedMk = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.status === "done" && t.assigned_to === "mk").sort((a, b) => {
      const da = a.completed_at || a.updated_at;
      const db = b.completed_at || b.updated_at;
      return new Date(db).getTime() - new Date(da).getTime();
    });
  }, [tasks]);

  // Determine if we should show all badges (only when "All Categories" filter)
  const showAllBadgesFlag = filterCategory === "all";

  // Column data — each task appears in exactly ONE column
  // In "review" mode (To Assign hidden), unassigned tasks roll into To Do's
  // In "all" mode, they split into separate columns
  const todoTasks = viewMode === "review"
    ? filtered.filter(t => t.assigned_to === "both" || t.assigned_to === "unassigned")
    : filtered.filter(t => t.assigned_to === "both");
  const unassignedTasks = filtered.filter(t => t.assigned_to === "unassigned");
  const leeTasks = filtered.filter(t => t.assigned_to === "lee");
  const mkTasks = filtered.filter(t => t.assigned_to === "mk");

  // Drag - custom collision that prefers droppable columns
  const customCollision: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    const columnIds = ["all", "unassigned", "lee", "mk"];
    // Prefer card-level hits for in-column reordering
    const cardHit = pointerCollisions.find(c => !columnIds.includes(c.id as string));
    if (cardHit) return [cardHit];
    // Fall back to column hit for cross-column drops
    const columnHit = pointerCollisions.find(c => columnIds.includes(c.id as string));
    if (columnHit) return [columnHit];
    return rectIntersection(args);
  };

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
    const columnIds = ["all", "unassigned", "lee", "mk"];
    const colMap: Record<string, string> = { all: "both", unassigned: "unassigned", lee: "lee", mk: "mk" };

    // Dropped on a column
    if (columnIds.includes(overId)) {
      const task = filtered.find(t => t.id === activeId);
      if (task && task.assigned_to !== colMap[overId]) {
        quickUpdate.mutate({ id: activeId, updates: { assigned_to: colMap[overId] } });
      }
      return;
    }

    // Dropped on another card — move to that card's column
    const overTask = filtered.find(t => t.id === overId);
    const activeTask = filtered.find(t => t.id === activeId);
    if (overTask && activeTask) {
      // Determine which column the over-task belongs to
      const overAssigned = overTask.assigned_to;
      if (activeTask.assigned_to !== overAssigned) {
        quickUpdate.mutate({ id: activeId, updates: { assigned_to: overAssigned } });
      } else {
        // Same column — reorder via sort_order
        const sameTasks = filtered
          .filter(t => t.assigned_to === overAssigned)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        const oldIdx = sameTasks.findIndex(t => t.id === activeId);
        const newIdx = sameTasks.findIndex(t => t.id === overId);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(sameTasks, oldIdx, newIdx);
          reordered.forEach((t, i) => {
            if (t.sort_order !== i) {
              quickUpdate.mutate({ id: t.id, updates: { sort_order: i } });
            }
          });
        }
      }
    }
  };

  const hasFilters = filterCategory !== "all" || filterAssignee !== "all" || !!filterDate;

  return (
    <DomainLayout
      title={trip?.location ? `${trip.location} — Planning` : "Trip Planning"}
      tagline="Organize your move"
      backgroundImage={holboxBg}
      actions={
        <div className="flex gap-2">
         <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowDueDateManager(true)}>
            <CalendarIcon className="mr-1 h-3.5 w-3.5" /> Set Due Dates
          </Button>
          <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => setShowPrintDialog(true)}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print View
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

      {/* Progress Tracker — always shows ALL categories */}
      {!isLoading && tasks && tasks.length > 0 && (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-white/70">Overall Progress</span>
            <span className="text-xs font-bold text-white">
              {(() => {
                const total = tasks.length;
                const done = tasks.filter(t => t.status === "done").length;
                return `${done} / ${total} done`;
              })()}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${(() => {
                  const total = tasks.length;
                  const done = tasks.filter(t => t.status === "done").length;
                  return total > 0 ? (done / total) * 100 : 0;
                })()}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="mb-4 flex items-center gap-1">
        <span className="text-[10px] text-white/40 mr-1 uppercase tracking-wider">View:</span>
        {[
          { value: "review" as const, label: "To Do's → Assign" },
          { value: "all" as const, label: "All Columns" },
        ].map(v => (
          <Button
            key={v.value}
            variant={viewMode === v.value ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs", viewMode === v.value ? "bg-white/15 text-white" : "text-white/50 hover:text-white")}
            onClick={() => setViewMode(v.value)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      {/* Board */}
      {isLoading ? (
        <p className="text-white/50 text-sm">Loading...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={customCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={cn(
            "grid grid-cols-1 gap-4",
            viewMode === "all" ? "md:grid-cols-4" : "md:grid-cols-3"
          )}>
            <PlanColumn id="all" label="To Do's" tasks={todoTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} onAdvance={advanceTask} onMarkDone={handleMarkDone} groupByCategory showAllBadges={showAllBadgesFlag}
              headerExtra={filterCategory === "selling" ? (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary hover:text-primary ml-auto" onClick={() => setShowBulkAdd(true)}>
                  <Plus className="h-2.5 w-2.5 mr-0.5" /> Bulk Add
                </Button>
              ) : undefined}
            />
            {viewMode === "all" && (
              <PlanColumn id="unassigned" label="To Assign" tasks={unassignedTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} onAdvance={advanceTask} onMarkDone={handleMarkDone} />
            )}
            <PlanColumn id="lee" label="Lee" tasks={leeTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} onAdvance={advanceTask} onMarkDone={handleMarkDone}
              headerExtra={completedLee.length > 0 ? (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-400 hover:text-emerald-300 ml-auto" onClick={() => setShowLeeCompleted(true)}>
                  <Check className="h-2.5 w-2.5 mr-0.5" /> Show Completed ({completedLee.length})
                </Button>
              ) : undefined}
            />
            <PlanColumn id="mk" label="MK" tasks={mkTasks} onEdit={startEdit} onDelete={(id) => deleteMutation.mutate(id)} onAdvance={advanceTask} onMarkDone={handleMarkDone}
              headerExtra={completedMk.length > 0 ? (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-400 hover:text-emerald-300 ml-auto" onClick={() => setShowMkCompleted(true)}>
                  <Check className="h-2.5 w-2.5 mr-0.5" /> Show Completed ({completedMk.length})
                </Button>
              ) : undefined}
            />
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

      {/* ¡Sí se puede! Celebration Dialog */}
      <Dialog open={!!celebrateTask} onOpenChange={(v) => { if (!v) cancelDone(); }}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-6 space-y-4">
            <PartyPopper className="h-12 w-12 mx-auto text-amber-400" />
            <h2 className="text-2xl font-bold text-foreground">¡Sí se puede!</h2>
            <p className="text-sm text-muted-foreground">
              {celebrateTask?.title}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmDone}>
                <Check className="mr-2 h-4 w-4" /> Confirmed Complete
              </Button>
              <Button variant="outline" onClick={cancelDone}>
                Still In Progress
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Completed - Lee */}
      <Dialog open={showLeeCompleted} onOpenChange={setShowLeeCompleted}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lee — Completed Tasks ({completedLee.length})</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {completedLee.map(t => (
              <div key={t.id} className="flex items-start justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    {t.completed_at && <span>Completed: {format(new Date(t.completed_at), "MMM d, yyyy")}</span>}
                    {t.target_date && <span>Due: {format(new Date(t.target_date + "T00:00:00"), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              </div>
            ))}
            {completedLee.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No completed tasks yet</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Completed - MK */}
      <Dialog open={showMkCompleted} onOpenChange={setShowMkCompleted}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>MK — Completed Tasks ({completedMk.length})</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {completedMk.map(t => (
              <div key={t.id} className="flex items-start justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    {t.completed_at && <span>Completed: {format(new Date(t.completed_at), "MMM d, yyyy")}</span>}
                    {t.target_date && <span>Due: {format(new Date(t.target_date + "T00:00:00"), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              </div>
            ))}
            {completedMk.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No completed tasks yet</p>}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Bulk Add Selling Items Dialog */}
      <Dialog open={showBulkAdd} onOpenChange={(v) => { if (!v) { setShowBulkAdd(false); setBulkItems([{ title: "", price: "" }]); } else setShowBulkAdd(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bulk Add — Selling & Downsizing</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Quickly add items to sell. Enter a title and optional listing price for each.</p>
          <div className="space-y-2 mt-2">
            {bulkItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={item.title}
                  onChange={e => { const items = [...bulkItems]; items[i].title = e.target.value; setBulkItems(items); }}
                  placeholder="Item name"
                  className="flex-1 h-8 text-xs"
                />
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    value={item.price}
                    onChange={e => { const items = [...bulkItems]; items[i].price = e.target.value; setBulkItems(items); }}
                    placeholder="0"
                    type="number"
                    className="h-8 text-xs pl-5"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBulkItems(bulkItems.filter((_, j) => j !== i))} disabled={bulkItems.length <= 1}>
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => setBulkItems([...bulkItems, { title: "", price: "" }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Another Row
            </Button>
          </div>
          <Button
            className="w-full mt-2"
            disabled={!bulkItems.some(i => i.title.trim())}
            onClick={async () => {
              if (!user || !tripId) return;
              const validItems = bulkItems.filter(i => i.title.trim());
              const inserts = validItems.map((item, idx) => ({
                trip_id: tripId,
                user_id: user.id,
                title: item.title.trim(),
                category: "selling",
                assigned_to: "unassigned",
                status: "todo",
                sold_price: item.price ? parseFloat(item.price) : null,
                sort_order: idx,
              }));
              const { error } = await supabase.from("trip_tasks").insert(inserts);
              if (error) { toast.error(error.message); return; }
              queryClient.invalidateQueries({ queryKey: ["trip-tasks", tripId] });
              setShowBulkAdd(false);
              setBulkItems([{ title: "", price: "" }]);
              toast.success(`Added ${validItems.length} items!`);
            }}
          >
            Add {bulkItems.filter(i => i.title.trim()).length} Items
          </Button>
        </DialogContent>
      </Dialog>

      {/* Print View Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Print View</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Category</Label>
              <Select value={printCategory} onValueChange={setPrintCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {TRIP_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Person</Label>
              <Select value={printAssignee} onValueChange={setPrintAssignee}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  {ASSIGNEES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Due Date</Label>
              <Select value={printDate || "all"} onValueChange={v => setPrintDate(v === "all" ? undefined : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  {presetDueDates.map(d => (
                    <SelectItem key={d} value={d}>{format(new Date(d + "T00:00:00"), "MMM d, yyyy")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => {
              // Build printable content
              if (!tasks) return;
              const printTasks = tasks.filter(t => {
                if (t.status === "done") return false;
                if (printCategory !== "all" && t.category !== printCategory) return false;
                if (printAssignee !== "all" && t.assigned_to !== printAssignee) return false;
                if (printDate && t.target_date !== printDate) return false;
                return true;
              });

              const catLabel = printCategory === "all" ? "All Categories" : TRIP_CATEGORIES.find(c => c.value === printCategory)?.label || printCategory;
              const assignLabel = printAssignee === "all" ? "Everyone" : ASSIGNEES.find(a => a.value === printAssignee)?.label || printAssignee;
              const dateLabel = printDate ? format(new Date(printDate + "T00:00:00"), "MMM d, yyyy") : "All Dates";

              const grouped: Record<string, typeof printTasks> = {};
              for (const t of printTasks) {
                const cat = TRIP_CATEGORIES.find(c => c.value === t.category)?.label || t.category;
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(t);
              }

              const html = `<!DOCTYPE html><html><head><title>Trip Planning — Print</title><style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; color: #1a1a1a; }
                h1 { font-size: 18px; margin-bottom: 4px; }
                .subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }
                h2 { font-size: 14px; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                .task { padding: 4px 0; font-size: 12px; display: flex; gap: 8px; align-items: baseline; }
                .task::before { content: "☐"; flex-shrink: 0; }
                .meta { color: #888; font-size: 10px; }
                @media print { body { padding: 0; } }
              </style></head><body>
              <h1>${trip?.location || "Trip"} — Tasks</h1>
              <div class="subtitle">${catLabel} · ${assignLabel} · ${dateLabel} · ${printTasks.length} tasks</div>
              ${Object.entries(grouped).map(([cat, items]) => `
                <h2>${cat}</h2>
                ${items.map(t => {
                  const assignee = t.assigned_to === "both" ? "" : t.assigned_to === "unassigned" ? " [Unassigned]" : ` [${t.assigned_to === "lee" ? "Lee" : "MK"}]`;
                  const date = t.target_date ? ` — ${format(new Date(t.target_date + "T00:00:00"), "MMM d")}` : "";
                  return `<div class="task"><span>${t.title}${assignee ? `<span class="meta">${assignee}</span>` : ""}${date ? `<span class="meta">${date}</span>` : ""}</span></div>`;
                }).join("")}
              `).join("")}
              </body></html>`;

              const printWindow = window.open("", "_blank");
              if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => printWindow.print(), 300);
              }
              setShowPrintDialog(false);
            }}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DomainLayout>
  );
}
