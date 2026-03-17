import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, MoreHorizontal, StickyNote } from "lucide-react";
import { toast } from "sonner";

interface Phase2AllViewProps {
  chapterId: string;
  onAssetClick?: (assetId: string) => void;
}

type Asset = {
  id: string;
  asset_name: string;
  source_ref: string | null;
  core_rank: number | null;
  phase2_status: string | null;
  whiteboard_status: string;
  video_production_status: string;
  mc_status: string;
  ebook_status: string;
  qa_status: string;
  deployment_status: string;
  admin_notes: any;
};

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-muted-foreground/40",
  in_progress: "bg-blue-400",
  complete: "bg-emerald-400",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status] || STATUS_DOT.not_started}`}
      title={status}
    />
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) return <span className="text-muted-foreground">—</span>;
  const colors: Record<number, string> = {
    1: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    2: "bg-muted text-muted-foreground border-border",
    3: "bg-muted/50 text-muted-foreground/60 border-border/50",
  };
  return <Badge variant="outline" className={`text-[10px] ${colors[rank] || ""}`}>R{rank}</Badge>;
}

export function Phase2AllView({ chapterId, onAssetClick }: Phase2AllViewProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [unreviewedOpen, setUnreviewedOpen] = useState(false);
  const [noteAssetId, setNoteAssetId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data: allAssets = [] } = useQuery({
    queryKey: ["phase2-all-assets", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, core_rank, phase2_status, whiteboard_status, video_production_status, mc_status, ebook_status, qa_status, deployment_status, admin_notes")
        .eq("chapter_id", chapterId)
        .not("asset_approved_at", "is", null)
        .order("core_rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Asset[];
    },
  });

  const sections = [
    { key: "core_asset", label: "Core Assets", items: allAssets.filter(a => a.phase2_status === "core_asset") },
    { key: "hold", label: "On Hold", items: allAssets.filter(a => a.phase2_status === "hold") },
    { key: "needs_debugging", label: "Needs Debugging", items: allAssets.filter(a => a.phase2_status === "needs_debugging") },
    { key: "skip", label: "Skipped", items: allAssets.filter(a => a.phase2_status === "skip") },
  ];
  const unreviewed = allAssets.filter(a => !a.phase2_status);

  const actionMutation = useMutation({
    mutationFn: async ({ assetId, updates }: { assetId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("teaching_assets").update(updates).eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phase2-all-assets", chapterId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const noteMutation = useMutation({
    mutationFn: async ({ asset, note }: { asset: Asset; note: string }) => {
      const existing = Array.isArray(asset.admin_notes) ? asset.admin_notes : [];
      const newNote = { id: crypto.randomUUID(), date: new Date().toISOString(), author: user?.email || "unknown", text: note };
      const { error } = await supabase.from("teaching_assets").update({ admin_notes: [...existing, newNote] } as any).eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added");
      setNoteText("");
      setNoteAssetId(null);
      qc.invalidateQueries({ queryKey: ["phase2-all-assets", chapterId] });
    },
  });

  const handleAction = (assetId: string, phase2_status: string | null, core_rank: number | null) => {
    const updates: Record<string, any> = { phase2_status, core_rank };
    if (phase2_status === "core_asset") updates.phase2_entered_at = new Date().toISOString();
    actionMutation.mutate({ assetId, updates });
    toast.success(phase2_status ? `Set to ${phase2_status}` : "Removed from Phase 2");
  };

  const renderRow = (asset: Asset) => {
    const assetName = asset.asset_name || "Untitled asset";

    return (
      <TableRow key={asset.id}>
        <TableCell className="font-mono text-xs font-bold">
          {onAssetClick ? (
            <button
              className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 font-mono text-xs font-bold"
              onClick={() => onAssetClick(asset.id)}
            >
              {assetName}
            </button>
          ) : assetName}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{asset.source_ref || "—"}</TableCell>
        <TableCell><RankBadge rank={asset.core_rank} /></TableCell>
        <TableCell><StatusDot status={asset.whiteboard_status} /></TableCell>
        <TableCell><StatusDot status={asset.video_production_status} /></TableCell>
        <TableCell><StatusDot status={asset.mc_status} /></TableCell>
        <TableCell><StatusDot status={asset.ebook_status} /></TableCell>
        <TableCell><StatusDot status={asset.qa_status} /></TableCell>
        <TableCell><StatusDot status={asset.deployment_status} /></TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {Array.isArray(asset.admin_notes) && asset.admin_notes.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <StickyNote className="h-3 w-3 text-amber-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-xs space-y-1">
                  {(asset.admin_notes as any[]).map((n: any) => (
                    <p key={n.id ?? `${asset.id}-${n.text ?? "note"}`}>
                      <span className="text-muted-foreground">{n?.date ? new Date(n.date).toLocaleDateString() : "Unknown date"}</span> — {n?.text ?? "No note text"}
                    </p>
                  ))}
                </PopoverContent>
              </Popover>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAction(asset.id, "core_asset", 1)}>Rank 1</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(asset.id, "core_asset", 2)}>Rank 2</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(asset.id, "core_asset", 3)}>Rank 3</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(asset.id, "hold", null)}>Move to Hold</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(asset.id, "needs_debugging", null)}>Needs Debugging</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(asset.id, "skip", null)}>Skip</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(asset.id, null, null)}>Remove from Phase 2</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setNoteAssetId(asset.id); setNoteText(""); }}>Add Note</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const tableHead = (
    <TableHeader>
      <TableRow>
        <TableHead className="text-xs">Asset</TableHead>
        <TableHead className="text-xs">Ref</TableHead>
        <TableHead className="text-xs">Rank</TableHead>
        <TableHead className="text-xs w-8">WB</TableHead>
        <TableHead className="text-xs w-8">Vid</TableHead>
        <TableHead className="text-xs w-8">MC</TableHead>
        <TableHead className="text-xs w-8">EB</TableHead>
        <TableHead className="text-xs w-8">QA</TableHead>
        <TableHead className="text-xs w-8">Dep</TableHead>
        <TableHead className="text-xs w-16"></TableHead>
      </TableRow>
    </TableHeader>
  );

  const inlineNoteAsset = allAssets.find(a => a.id === noteAssetId);

  return (
    <div className="space-y-6">
      {noteAssetId && inlineNoteAsset && (
        <div className="flex gap-2 items-start p-3 rounded-lg border border-border bg-card">
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add note…" className="text-sm min-h-[50px] flex-1" />
          <div className="flex flex-col gap-1">
            <Button size="sm" disabled={!noteText.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate({ asset: inlineNoteAsset, note: noteText.trim() })}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setNoteAssetId(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {sections.filter(s => s.items.length > 0).map(section => (
        <div key={section.key}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-foreground">{section.label}</h3>
            <Badge variant="secondary" className="text-[10px]">{section.items.length}</Badge>
          </div>
          <Table>
            {tableHead}
            <TableBody>{section.items.map(renderRow)}</TableBody>
          </Table>
        </div>
      ))}

      {unreviewed.length > 0 && (
        <Collapsible open={unreviewedOpen} onOpenChange={setUnreviewedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="text-sm text-muted-foreground gap-1">
              {unreviewedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Show {unreviewed.length} unreviewed
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Table>
              {tableHead}
              <TableBody>{unreviewed.map(renderRow)}</TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
