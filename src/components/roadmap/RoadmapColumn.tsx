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
} from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { RoadmapItemRow } from "./RoadmapItemRow";

interface RoadmapColumnProps {
  label: string;
  items: any[];
  statusValue: string;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onReorder: (statusValue: string, oldIndex: number, newIndex: number) => void;
  variant?: "default" | "active" | "completed";
  semesterGroups?: Record<string, any[]>;
}

export function RoadmapColumn({
  label,
  items,
  statusValue,
  onUpdate,
  onDelete,
  onReorder,
  variant = "default",
  semesterGroups,
}: RoadmapColumnProps) {
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
    <div className={`rounded-xl border p-3 ${headerStyles[variant]} flex flex-col min-h-[200px]`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className={`text-sm font-semibold ${titleStyles[variant]}`}>
          {variant === "active" && "🔥 "}{label}
        </h2>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>

      {semesterGroups ? (
        <div className="space-y-4 flex-1">
          {Object.entries(semesterGroups).map(([semester, semItems]) => (
            <div key={semester}>
              <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1 uppercase tracking-wider">
                {semester}
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={semItems.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {semItems.map((item: any) => (
                      <RoadmapItemRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ))}
          {Object.keys(semesterGroups).length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-6">No planned items</p>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5 flex-1">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-6">No items</p>
              ) : (
                items.map((item) => (
                  <RoadmapItemRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
