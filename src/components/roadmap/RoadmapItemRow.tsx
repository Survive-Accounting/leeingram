import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Rocket, GripVertical, ChevronDown, Pencil, Check, X, Archive } from "lucide-react";
import { CATEGORIES, PRIORITIES, STATUSES, SEMESTERS, ARCHIVED_STATUS } from "./RoadmapConstants";

interface RoadmapItemRowProps {
  item: any;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
}

export function RoadmapItemRow({ item, onUpdate, onDelete }: RoadmapItemRowProps) {
  const [descOpen, setDescOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDesc, setEditDesc] = useState(item.description || "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityStyle = PRIORITIES.find((p) => p.value === item.priority)?.style || "";

  const allStatuses = [...STATUSES, ARCHIVED_STATUS];

  const saveEdit = () => {
    onUpdate(item.id, { title: editTitle, description: editDesc });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditTitle(item.title);
    setEditDesc(item.description || "");
    setEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="group border-border/60">
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none shrink-0"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-1.5">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-7 text-xs" />
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="text-xs" placeholder="Description..." />
                </div>
              ) : (
                <h3 className="text-xs font-medium text-foreground leading-tight truncate">{item.title}</h3>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {editing ? (
                <>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}><Check className="h-3 w-3 text-green-600" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}><X className="h-3 w-3 text-destructive" /></Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditing(true)}>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onUpdate(item.id, { status: "archived" })}>
                    <Archive className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(item.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {!editing && item.description && (
            <Collapsible open={descOpen} onOpenChange={setDescOpen}>
              <CollapsibleTrigger asChild>
                <button className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5 pl-5">
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${descOpen ? "rotate-180" : ""}`} />
                  {descOpen ? "Hide" : "Details"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">{item.description}</p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex flex-wrap items-center gap-1 pl-5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityStyle}`}>
              {PRIORITIES.find((p) => p.value === item.priority)?.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
            </Badge>
            {item.target_semester && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.target_semester}</Badge>
            )}

            <div className="flex gap-1 ml-auto">
              <Select value={item.status} onValueChange={(v) => onUpdate(item.id, { status: v })}>
                <SelectTrigger className="h-6 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={item.category} onValueChange={(v) => onUpdate(item.id, { category: v })}>
                <SelectTrigger className="h-6 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={item.priority} onValueChange={(v) => onUpdate(item.id, { priority: v })}>
                <SelectTrigger className="h-6 text-[10px] w-[85px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pl-5">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-[10px] h-6 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                const msg = `Let's build the "${item.title}" feature. Here's the description: ${item.description || "No description provided."}`;
                navigator.clipboard.writeText(msg);
                import("sonner").then(({ toast }) =>
                  toast.success("Copied prompt to clipboard — paste it in chat to start building!")
                );
              }}
            >
              <Rocket className="mr-1 h-2.5 w-2.5" /> Let's Build This
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
