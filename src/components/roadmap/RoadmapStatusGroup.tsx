import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { RoadmapItemRow } from "./RoadmapItemRow";

interface RoadmapStatusGroupProps {
  label: string;
  items: any[];
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onReorder: (statusValue: string, oldIndex: number, newIndex: number) => void;
  statusValue: string;
}

export function RoadmapStatusGroup({
  label,
  items,
  onUpdate,
  onDelete,
  onReorder,
  statusValue,
}: RoadmapStatusGroupProps) {
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    onReorder(statusValue, oldIndex, newIndex);
  };

  if (items.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 pl-2 pr-1 pb-3">
              {items.map((item) => (
                <RoadmapItemRow
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  );
}
