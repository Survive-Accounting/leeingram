import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { RoadmapColumn } from "@/components/roadmap/RoadmapColumn";
import { RoadmapItemRow } from "@/components/roadmap/RoadmapItemRow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";

interface ContentBoardProps {
  items: any[];
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onAddItem: () => void;
}

export function ContentBoard({ items, onUpdate, onDelete, onAddItem }: ContentBoardProps) {
  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>({});
  const [activeItem, setActiveItem] = useState<any>(null);
  const [confirmItem, setConfirmItem] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortAndOrder = (list: any[], statusValue: string) => {
    let sorted = [...list];
    const order = localOrder[statusValue];
    if (order) {
      const idMap = new Map(sorted.map((i) => [i.id, i]));
      const ordered = order.map((id) => idMap.get(id)).filter(Boolean) as any[];
      const remaining = sorted.filter((i) => !order.includes(i.id));
      sorted = [...ordered, ...remaining];
    }
    return sorted;
  };

  const ideaItems = sortAndOrder(items.filter((i) => i.status === "idea"), "idea");
  const inProgressItems = sortAndOrder(items.filter((i) => i.status === "in_progress"), "in_progress");
  const doneItems = sortAndOrder(items.filter((i) => i.status === "done"), "done");

  const statusMap: Record<string, string> = { idea: "idea", in_progress: "in_progress", done: "done" };

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (statusMap[overId]) {
      const item = items.find((i) => i.id === activeId);
      if (item && item.status !== overId) {
        if (overId === "done") {
          setConfirmItem(item);
        } else {
          onUpdate(activeId, { status: overId });
        }
      }
      return;
    }

    const overItem = items.find((i) => i.id === overId);
    const activeItemData = items.find((i) => i.id === activeId);
    if (!overItem || !activeItemData) return;

    if (activeItemData.status !== overItem.status) {
      if (overItem.status === "done") {
        setConfirmItem(activeItemData);
      } else {
        onUpdate(activeId, { status: overItem.status });
      }
    } else {
      const statusKey = activeItemData.status;
      const listMap: Record<string, any[]> = { idea: ideaItems, in_progress: inProgressItems, done: doneItems };
      const list = listMap[statusKey];
      if (!list) return;
      const oldIndex = list.findIndex((i) => i.id === activeId);
      const newIndex = list.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const ids = list.map((i) => i.id);
        const reordered = arrayMove(ids, oldIndex, newIndex);
        setLocalOrder((prev) => ({ ...prev, [statusKey]: reordered }));
      }
    }
  };

  const confirmComplete = () => {
    if (!confirmItem) return;
    onUpdate(confirmItem.id, { status: "done", completed_at: new Date().toISOString() });
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    toast.success("🎉 Content completed!");
    setConfirmItem(null);
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoadmapColumn label="Ideas" items={ideaItems} statusValue="idea" onUpdate={onUpdate} onDelete={onDelete} />
          <RoadmapColumn label="In Progress" items={inProgressItems} statusValue="in_progress" onUpdate={onUpdate} onDelete={onDelete} variant="active" />
          <RoadmapColumn label="Done" items={doneItems} statusValue="done" onUpdate={onUpdate} onDelete={onDelete} variant="completed" />
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="opacity-90 rotate-2 scale-105 pointer-events-none">
              <RoadmapItemRow item={activeItem} onUpdate={() => {}} onDelete={() => {}} isDragOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <Button variant="ghost" size="sm" className="mt-2 text-xs text-muted-foreground" onClick={onAddItem}>
        <Plus className="mr-1 h-3 w-3" /> Add Content Item
      </Button>

      {/* Confirm completion dialog */}
      <Dialog open={!!confirmItem} onOpenChange={(o) => !o && setConfirmItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 Mark as Done?</DialogTitle>
            <DialogDescription>Confirm that "{confirmItem?.title}" is complete?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)}>Not Yet</Button>
            <Button onClick={confirmComplete}>Complete 🎉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
