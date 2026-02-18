import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { RoadmapItemRow } from "./RoadmapItemRow";

interface RoadmapColumnProps {
  label: string;
  items: any[];
  statusValue: string;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  variant?: "default" | "active" | "completed";
  semesterGroups?: Record<string, any[]>;
}

export function RoadmapColumn({
  label,
  items,
  statusValue,
  onUpdate,
  onDelete,
  variant = "default",
  semesterGroups,
}: RoadmapColumnProps) {
  const { setNodeRef } = useDroppable({ id: statusValue });

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
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-3 ${headerStyles[variant]} flex flex-col min-h-[200px]`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className={`text-sm font-semibold ${titleStyles[variant]}`}>
          {variant === "active" && "🔥 "}{label}
        </h2>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>

      {semesterGroups ? (
        <div className="space-y-3 flex-1">
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {Object.entries(semesterGroups).map(([semester, semItems]) => (
              <div key={semester}>
                <div className="text-[10px] font-medium text-muted-foreground mb-1 px-1 uppercase tracking-wider">
                  {semester}
                </div>
                <div className="space-y-1">
                  {semItems.map((item: any) => (
                    <RoadmapItemRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            ))}
          </SortableContext>
          {Object.keys(semesterGroups).length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-6">No planned items</p>
          )}
        </div>
      ) : (
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 flex-1">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-6">No items</p>
            ) : (
              items.map((item) => (
                <RoadmapItemRow key={item.id} item={item} onUpdate={onUpdate} onDelete={onDelete} />
              ))
            )}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
