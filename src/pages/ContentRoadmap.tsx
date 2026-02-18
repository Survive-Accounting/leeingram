import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { ChevronDown, GripVertical, ChevronRight, Trophy, Plus } from "lucide-react";
import confetti from "canvas-confetti";

interface LessonItem {
  id: string;
  lesson_title: string;
  lesson_status: string;
  chapter_id: string;
  course_id: string;
  created_at: string;
  courseName?: string;
  chapterName?: string;
  chapterNumber?: number;
}

function LessonCard({ item, isDragOverlay }: { item: LessonItem; isDragOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id, disabled: isDragOverlay,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group border-border/80 bg-card hover:border-border transition-colors">
        <div className="p-2.5 flex items-center gap-1.5">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0">
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-foreground leading-tight truncate block">{item.lesson_title}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight">{item.courseName}</Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 leading-tight">Ch {item.chapterNumber}</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ContentColumn({
  label, items, statusValue, variant = "default", onConfirmComplete, completedItems,
}: {
  label: string; items: LessonItem[]; statusValue: string;
  variant?: "default" | "active" | "completed";
  onConfirmComplete?: () => void;
  completedItems?: LessonItem[];
}) {
  const { setNodeRef } = useDroppable({ id: statusValue });
  const [showHistory, setShowHistory] = useState(false);

  const headerStyles = {
    default: "bg-muted/50 border-border",
    active: "bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(218,165,32,0.15)]",
    completed: "bg-emerald-500/10 border-emerald-500/30",
  };
  const titleStyles = {
    default: "text-foreground",
    active: "text-amber-600 dark:text-amber-400 font-bold text-base",
    completed: "text-emerald-700 dark:text-emerald-400",
  };

  return (
    <div ref={setNodeRef} className={`rounded-xl border p-3 ${headerStyles[variant]} flex flex-col min-h-[200px]`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className={`text-sm font-semibold ${titleStyles[variant]}`}>
          {variant === "active" && "🔥 "}{label}
        </h2>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        {variant === "completed" && completedItems && completedItems.length > 0 && (
          <>
            <button onClick={() => setShowHistory(true)} className="ml-auto text-[10px] text-primary hover:underline cursor-pointer">
              <Trophy className="h-3 w-3 inline mr-0.5" />History
            </button>
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Completed Lessons</DialogTitle>
                  <DialogDescription>All lessons marked as Published.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {completedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border rounded-md p-2 text-xs">
                      <span className="font-medium text-foreground truncate">{item.lesson_title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{item.courseName}</Badge>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-6">No items</p>
          ) : (
            items.map((item) => <LessonCard key={item.id} item={item} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function ContentRoadmap() {
  const queryClient = useQueryClient();
  const [activeItem, setActiveItem] = useState<LessonItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<LessonItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: courses } = useQuery({
    queryKey: ["courses"], queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at");
      if (error) throw error; return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters"], queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*").order("chapter_number");
      if (error) throw error; return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons"], queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*");
      if (error) throw error; return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("lessons").update({ lesson_status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lessons"] }),
  });

  const enrichedLessons: LessonItem[] = useMemo(() => {
    if (!lessons || !courses || !chapters) return [];
    return lessons.map((l: any) => ({
      ...l,
      courseName: courses.find((c: any) => c.id === l.course_id)?.course_name || "",
      chapterName: chapters.find((ch: any) => ch.id === l.chapter_id)?.chapter_name || "",
      chapterNumber: chapters.find((ch: any) => ch.id === l.chapter_id)?.chapter_number || 0,
    }));
  }, [lessons, courses, chapters]);

  // Map lesson_status to columns
  const planned = enrichedLessons.filter((l) => l.lesson_status === "Planning");
  const inProgress = enrichedLessons.filter((l) => ["Sheet Generated", "Filming", "Editing"].includes(l.lesson_status));
  const completed = enrichedLessons.filter((l) => l.lesson_status === "Published");

  const statusToColumn: Record<string, string> = {
    planned: "Planning", in_progress: "Filming", completed: "Published",
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveItem(enrichedLessons.find((l) => l.id === id) || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const item = enrichedLessons.find((l) => l.id === activeId);
    if (!item) return;

    // Dropped on column
    if (["planned", "in_progress", "completed"].includes(overId)) {
      const newStatus = statusToColumn[overId];
      if (overId === "completed") {
        setConfirmItem(item);
      } else if (item.lesson_status !== newStatus) {
        updateMutation.mutate({ id: activeId, status: newStatus });
        toast.success(`Moved to ${overId === "in_progress" ? "In Progress" : "Planned"}`);
      }
      return;
    }

    // Dropped on another item
    const overItem = enrichedLessons.find((l) => l.id === overId);
    if (overItem && item.lesson_status !== overItem.lesson_status) {
      if (overItem.lesson_status === "Published") {
        setConfirmItem(item);
      } else {
        updateMutation.mutate({ id: activeId, status: overItem.lesson_status });
      }
    }
  };

  const confirmComplete = () => {
    if (!confirmItem) return;
    updateMutation.mutate({ id: confirmItem.id, status: "Published" });
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    toast.success("🎉 Whoop Whoop! Lesson completed!");
    setConfirmItem(null);
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Roadmap</h1>
          <p className="text-sm text-muted-foreground">Track lesson production across all courses</p>
        </div>
        <Button asChild>
          <Link to="/create-lesson">
            <Plus className="mr-1 h-4 w-4" /> Create Lesson
          </Link>
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ContentColumn label="Planned" items={planned} statusValue="planned" />
          <ContentColumn label="In Progress" items={inProgress} statusValue="in_progress" variant="active" />
          <ContentColumn label="Completed" items={completed} statusValue="completed" variant="completed" completedItems={completed} />
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="opacity-95 rotate-1 scale-105 pointer-events-none">
              <LessonCard item={activeItem} isDragOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Confirm Completion Dialog */}
      <Dialog open={!!confirmItem} onOpenChange={(o) => !o && setConfirmItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 Whoop Whoop!</DialogTitle>
            <DialogDescription>
              Confirm that "{confirmItem?.lesson_title}" is complete?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmItem(null)}>Still in Progress</Button>
            <Button onClick={confirmComplete}>Confirm Completion</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
