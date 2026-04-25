import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  Pencil,
  Video as VideoIcon,
  Image as ImageIcon,
  ExternalLink,
  Link as LinkIcon,
  GripVertical,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ADMIN_EMAIL = "lee@survivestudios.com";

const STATUSES = ["Not Started", "In Progress", "Testing", "Live"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLES: Record<Status, { bg: string; text: string; dot: string }> = {
  "Not Started": { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  "In Progress": { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
  Testing: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  Live: { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
};

type Feature = {
  id: string;
  title: string;
  description: string;
  bullet_points: string[];
  video_url: string | null;
  image_url: string | null;
  page_url: string | null;
  status: Status;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function getYouTubeEmbed(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  if (url.includes("loom.com/share/")) return url.replace("/share/", "/embed/");
  return url;
}

function FeatureCard({
  feature,
  canEdit,
  onChange,
  onDelete,
  dragHandle,
}: {
  feature: Feature;
  canEdit: boolean;
  onChange: (next: Feature) => Promise<void>;
  onDelete: () => Promise<void>;
  dragHandle?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Feature>(feature);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(feature), [feature]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onChange(draft);
      setEditing(false);
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const embed = feature.video_url ? getYouTubeEmbed(feature.video_url) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {dragHandle}
          <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="text-lg font-semibold"
            />
          ) : (
            <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
          )}
          </div>
        </div>
        {editing ? (
          <Select
            value={draft.status}
            onValueChange={(v) => setDraft({ ...draft, status: v as Status })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <StatusPill status={feature.status} />
        )}
      </div>

      {editing ? (
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="mb-3 text-sm"
          rows={2}
        />
      ) : (
        feature.description && (
          <p className="text-sm text-slate-600 mb-3">{feature.description}</p>
        )
      )}

      {editing ? (
        <div className="space-y-2 mb-3">
          <Label className="text-xs">Bullet points (one per line)</Label>
          <Textarea
            value={draft.bullet_points.join("\n")}
            onChange={(e) =>
              setDraft({
                ...draft,
                bullet_points: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            rows={4}
            className="text-sm"
          />
        </div>
      ) : (
        feature.bullet_points.length > 0 && (
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 mb-3">
            {feature.bullet_points.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )
      )}

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs flex items-center gap-1">
              <VideoIcon className="h-3 w-3" /> Video URL
            </Label>
            <Input
              value={draft.video_url ?? ""}
              onChange={(e) => setDraft({ ...draft, video_url: e.target.value || null })}
              placeholder="YouTube / Loom URL"
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Image URL
            </Label>
            <Input
              value={draft.image_url ?? ""}
              onChange={(e) => setDraft({ ...draft, image_url: e.target.value || null })}
              placeholder="https://..."
              className="text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <LinkIcon className="h-3 w-3" /> Page URL
            </Label>
            <Input
              value={draft.page_url ?? ""}
              onChange={(e) => setDraft({ ...draft, page_url: e.target.value || null })}
              placeholder="/admin/... or https://..."
              className="text-sm"
            />
          </div>
        </div>
      )}

      {!editing && embed && (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-100 mb-3">
          <iframe
            src={embed}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {!editing && feature.image_url && (
        <img
          src={feature.image_url}
          alt={feature.title}
          className="w-full rounded-lg border border-slate-200 mb-3"
        />
      )}

      {!editing && feature.page_url && (
        <a
          href={feature.page_url}
          target={feature.page_url.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View page
          <span className="text-xs text-slate-400 font-normal truncate max-w-[260px]">
            {feature.page_url}
          </span>
        </a>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-100">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(feature);
                  setEditing(false);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (confirm(`Delete "${feature.title}"?`)) await onDelete();
                }}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddFeatureModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (
    f: Omit<Feature, "id" | "created_at" | "updated_at" | "sort_order">,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bullets, setBullets] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [status, setStatus] = useState<Status>("Not Started");
  const [saving, setSaving] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [buildSteps, setBuildSteps] = useState<string[]>([]);
  const [testingSteps, setTestingSteps] = useState<string[]>([]);
  const [buildOpen, setBuildOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const [descTouched, setDescTouched] = useState(false);
  const [bulletsTouched, setBulletsTouched] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setBullets("");
    setVideoUrl("");
    setImageUrl("");
    setPageUrl("");
    setStatus("Not Started");
    setBuildSteps([]);
    setTestingSteps([]);
    setBuildOpen(false);
    setTestOpen(false);
    setDescTouched(false);
    setBulletsTouched(false);
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error("Enter a title first");
      return;
    }
    const willOverwriteDesc = descTouched && description.trim().length > 0;
    const willOverwriteBullets = bulletsTouched && bullets.trim().length > 0;
    if (
      (willOverwriteDesc || willOverwriteBullets) &&
      !confirm("You've edited Description or Bullets. Overwrite with AI output?")
    ) {
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-feature-details", {
        body: { title: title.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (typeof data.description === "string") {
        setDescription(data.description);
        setDescTouched(false);
      }
      if (Array.isArray(data.bullet_points)) {
        setBullets(data.bullet_points.join("\n"));
        setBulletsTouched(false);
      }
      if (Array.isArray(data.build_steps)) {
        setBuildSteps(data.build_steps);
        setBuildOpen(true);
      }
      if (Array.isArray(data.testing_steps)) {
        setTestingSteps(data.testing_steps);
        setTestOpen(true);
      }
      toast.success("Details generated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const allBullets = [
        ...bullets.split("\n").map((s) => s.trim()).filter(Boolean),
        ...(buildSteps.length ? ["", "Build Steps:"] : []),
        ...buildSteps.map((s) => `• ${s}`),
        ...(testingSteps.length ? ["", "Testing Steps:"] : []),
        ...testingSteps.map((s) => `• ${s}`),
      ];
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        bullet_points: allBullets,
        video_url: videoUrl.trim() || null,
        image_url: imageUrl.trim() || null,
        page_url: pageUrl.trim() || null,
        status,
      });
      reset();
      onClose();
      toast.success("Feature added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Feature</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <div className="flex gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerate}
                disabled={generating || !title.trim()}
                className="shrink-0"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                Generate Details
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              AI fills description, bullets, build & testing steps from your title.
            </p>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescTouched(true);
              }}
              rows={2}
            />
          </div>
          <div>
            <Label>Bullet points (one per line)</Label>
            <Textarea
              value={bullets}
              onChange={(e) => {
                setBullets(e.target.value);
                setBulletsTouched(true);
              }}
              rows={4}
            />
          </div>

          {(buildSteps.length > 0 || testingSteps.length > 0) && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              {buildSteps.length > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBuildOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span>Build Steps ({buildSteps.length})</span>
                    {buildOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {buildOpen && (
                    <div className="px-3 pb-3">
                      <Textarea
                        value={buildSteps.join("\n")}
                        onChange={(e) =>
                          setBuildSteps(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))
                        }
                        rows={Math.min(10, Math.max(4, buildSteps.length))}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
              {testingSteps.length > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTestOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <span>Testing Steps ({testingSteps.length})</span>
                    {testOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {testOpen && (
                    <div className="px-3 pb-3">
                      <Textarea
                        value={testingSteps.join("\n")}
                        onChange={(e) =>
                          setTestingSteps(
                            e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                          )
                        }
                        rows={Math.min(10, Math.max(4, testingSteps.length))}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Video URL</Label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Page URL</Label>
            <Input
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="/admin/... or https://..."
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              Add Feature
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableFeatureCard({
  feature,
  canEdit,
  onChange,
  onDelete,
}: {
  feature: Feature;
  canEdit: boolean;
  onChange: (next: Feature) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: feature.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  const handle = canEdit ? (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="mt-1 -ml-1 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  ) : null;

  return (
    <div ref={setNodeRef} style={style}>
      <FeatureCard
        feature={feature}
        canEdit={canEdit}
        onChange={onChange}
        onDelete={onDelete}
        dragHandle={handle}
      />
    </div>
  );
}

export default function WebDevSprints() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.email === ADMIN_EMAIL;

  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = features.findIndex((f) => f.id === active.id);
    const newIndex = features.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(features, oldIndex, newIndex).map((f, i) => ({
      ...f,
      sort_order: i + 1,
    }));
    setFeatures(reordered); // optimistic

    const results = await Promise.all(
      reordered.map((f) =>
        supabase.from("web_dev_features").update({ sort_order: f.sort_order }).eq("id", f.id),
      ),
    );
    if (results.some((r) => r.error)) {
      toast.error("Failed to save order");
      await load();
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("web_dev_features")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setFeatures((data ?? []) as Feature[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (next: Feature) => {
    const { error } = await supabase
      .from("web_dev_features")
      .update({
        title: next.title,
        description: next.description,
        bullet_points: next.bullet_points,
        video_url: next.video_url,
        image_url: next.image_url,
        page_url: next.page_url,
        status: next.status,
      })
      .eq("id", next.id);
    if (error) throw error;
    await load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("web_dev_features").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    await load();
  };

  const handleCreate = async (
    f: Omit<Feature, "id" | "created_at" | "updated_at" | "sort_order">,
  ) => {
    const maxOrder = features.reduce((m, x) => Math.max(m, x.sort_order), 0);
    const { error } = await supabase.from("web_dev_features").insert({
      ...f,
      sort_order: maxOrder + 1,
    });
    if (error) throw error;
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/domains")}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs uppercase tracking-widest mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </button>

        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 mb-1">
              Web Development Sprints
            </h1>
            <p className="text-slate-500 text-sm">Track major features and progress</p>
          </div>
          {canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Feature
            </Button>
          )}
        </div>

        {(() => {
          const counts: Record<string, number> = { All: features.length };
          STATUSES.forEach((s) => (counts[s] = features.filter((f) => f.status === s).length));
          const pills: ("All" | Status)[] = ["All", ...STATUSES];
          return (
            <div className="flex flex-wrap gap-2 mb-6">
              {pills.map((p) => {
                const active = statusFilter === p;
                const dot = p === "All" ? "bg-slate-400" : STATUS_STYLES[p as Status].dot;
                return (
                  <button
                    key={p}
                    onClick={() => setStatusFilter(p)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {p}
                    <span className={`text-[10px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                      {counts[p]}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}
        {(() => {
          const visible =
            statusFilter === "All" ? features : features.filter((f) => f.status === statusFilter);
          if (loading)
            return <div className="text-center text-slate-400 py-16">Loading…</div>;
          if (features.length === 0)
            return (
              <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-dashed border-slate-200">
                No features yet.
              </div>
            );
          if (visible.length === 0)
            return (
              <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-dashed border-slate-200">
                No features with status "{statusFilter}".
              </div>
            );
          return (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visible.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 gap-5">
                  {visible.map((f) => (
                    <SortableFeatureCard
                      key={f.id}
                      feature={f}
                      canEdit={canEdit && statusFilter === "All"}
                      onChange={handleUpdate}
                      onDelete={() => handleDelete(f.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          );
        })()}
      </div>

      <AddFeatureModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
