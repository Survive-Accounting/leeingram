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
import { Trash2, Rocket, GripVertical, ChevronDown, Pencil, Check, X } from "lucide-react";
import { CATEGORIES, PRIORITIES, STATUSES, SEMESTERS } from "./RoadmapConstants";

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
      <Card className="group">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="text-xs"
                    placeholder="Description..."
                  />
                </div>
              ) : (
                <h3 className="text-sm font-medium text-foreground leading-tight truncate">
                  {item.title}
                </h3>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {editing ? (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {!editing && item.description && (
            <Collapsible open={descOpen} onOpenChange={setDescOpen}>
              <CollapsibleTrigger asChild>
                <button className="text-xs text-primary/70 hover:text-primary flex items-center gap-1">
                  <ChevronDown className={`h-3 w-3 transition-transform ${descOpen ? "rotate-180" : ""}`} />
                  {descOpen ? "Hide description" : "Show description"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-xs text-muted-foreground mt-1 pl-6">{item.description}</p>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pl-6">
            <Badge variant="outline" className={`text-xs ${priorityStyle}`}>
              {PRIORITIES.find((p) => p.value === item.priority)?.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
            </Badge>
            {item.target_semester && (
              <Badge variant="secondary" className="text-xs">{item.target_semester}</Badge>
            )}

            <div className="flex gap-1.5 ml-auto">
              <Select
                value={item.status}
                onValueChange={(v) => onUpdate(item.id, { status: v })}
              >
                <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={item.category}
                onValueChange={(v) => onUpdate(item.id, { category: v })}
              >
                <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={item.priority}
                onValueChange={(v) => onUpdate(item.id, { priority: v })}
              >
                <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={item.target_semester || ""}
                onValueChange={(v) => onUpdate(item.id, { target_semester: v })}
              >
                <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue placeholder="Semester" /></SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pl-6">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                const msg = `Let's build the "${item.title}" feature. Here's the description: ${item.description || "No description provided."}`;
                navigator.clipboard.writeText(msg);
                import("sonner").then(({ toast }) =>
                  toast.success("Copied prompt to clipboard — paste it in chat to start building!")
                );
              }}
            >
              <Rocket className="mr-1 h-3 w-3" /> Let's Build This
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
