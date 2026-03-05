import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Play, FileSpreadsheet, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppLayout from "@/components/AppLayout";

export default function TemplateManager() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newFileId, setNewFileId] = useState("");
  const [newVersion, setNewVersion] = useState("v1");

  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [syncLog, setSyncLog] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["sheet_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheet_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch assets with sheets
  const { data: assets = [] } = useQuery({
    queryKey: ["assets_with_sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, asset_code, google_sheet_url, chapter_number, course_id")
        .neq("google_sheet_url", "")
        .order("asset_code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch chapters
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters_for_sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("chapter_number");
      if (error) throw error;
      return data;
    },
  });

  const activeTemplate = templates.find((t: any) => t.is_active);

  // Create template
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sheet_templates" as any).insert({
        name: newName,
        template_file_id: newFileId,
        version: newVersion,
        is_active: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheet_templates"] });
      setNewName(""); setNewFileId(""); setNewVersion("v1");
      toast({ title: "Template created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Toggle active
  const toggleActive = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all
      await supabase.from("sheet_templates" as any).update({ is_active: false } as any).neq("id", "placeholder-never-match");
      // Activate selected
      await supabase.from("sheet_templates" as any).update({ is_active: true } as any).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheet_templates"] }),
  });

  // Sync one asset
  async function syncAsset(assetId: string) {
    if (!activeTemplate) {
      toast({ title: "No active template", variant: "destructive" });
      return null;
    }
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await supabase.functions.invoke("sync-asset-sheet-to-template", {
      body: {
        asset_id: assetId,
        template_file_id: activeTemplate.template_file_id,
        template_version: activeTemplate.version,
        dry_run: dryRun,
      },
    });
    return res.data;
  }

  async function handleSyncOne() {
    if (!selectedAssetId) return;
    setSyncing(true);
    setSyncLog(null);
    try {
      const result = await syncAsset(selectedAssetId);
      setSyncLog(result);
      toast({ title: result?.success ? "Sync complete" : "Sync failed" });
    } catch (e: any) {
      setSyncLog({ error: e.message });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncChapter() {
    if (!selectedChapterId || !activeTemplate) return;
    const chapterAssets = assets.filter((a) => {
      const ch = chapters.find((c) => c.id === selectedChapterId);
      return ch && a.chapter_number === ch.chapter_number;
    });
    if (chapterAssets.length === 0) {
      toast({ title: "No assets with sheets in this chapter", variant: "destructive" });
      return;
    }
    setSyncing(true);
    setSyncLog(null);
    const results: any[] = [];
    for (const a of chapterAssets) {
      try {
        const r = await syncAsset(a.id);
        results.push({ asset_code: a.asset_code, ...r });
      } catch (e: any) {
        results.push({ asset_code: a.asset_code, error: e.message });
      }
    }
    setSyncLog({ batch: true, count: results.length, results });
    setSyncing(false);
    toast({ title: `Synced ${results.length} assets` });
  }

  async function handleSyncAll() {
    if (!activeTemplate) return;
    setSyncing(true);
    setSyncLog(null);
    const results: any[] = [];
    for (const a of assets) {
      try {
        const r = await syncAsset(a.id);
        results.push({ asset_code: a.asset_code, ...r });
      } catch (e: any) {
        results.push({ asset_code: a.asset_code, error: e.message });
      }
    }
    setSyncLog({ batch: true, count: results.length, results });
    setSyncing(false);
    toast({ title: `Synced ${results.length} assets` });
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Sheet Template Manager</h1>

        {/* Active Template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Active Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTemplate ? (
              <div className="flex items-center gap-4">
                <Badge variant="default">{activeTemplate.version}</Badge>
                <span className="font-medium text-foreground">{activeTemplate.name}</span>
                <span className="text-sm text-muted-foreground font-mono">{activeTemplate.template_file_id}</span>
              </div>
            ) : (
              <p className="text-muted-foreground">No active template. Create one and set it active below.</p>
            )}
          </CardContent>
        </Card>

        {/* Templates List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingTemplates ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="space-y-2">
                {templates.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card">
                    <Badge variant={t.is_active ? "default" : "outline"}>{t.version}</Badge>
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground font-mono flex-1">{t.template_file_id}</span>
                    {t.is_active ? (
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => toggleActive.mutate(t.id)}>
                        Set Active
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new template */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Add Template</p>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder="Google Sheet File ID" value={newFileId} onChange={(e) => setNewFileId(e.target.value)} />
                <Input placeholder="Version (e.g. v1)" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newName || !newFileId || createMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Add Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5" />
              Sync Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
              <Label htmlFor="dry-run" className="text-foreground">
                Dry Run {dryRun && <span className="text-muted-foreground">(preview only, no changes)</span>}
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sync one */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Test Sync on One Asset</p>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger><SelectValue placeholder="Pick asset..." /></SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.asset_code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleSyncOne} disabled={syncing || !selectedAssetId || !activeTemplate}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Sync One
                </Button>
              </div>

              {/* Sync chapter */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Sync Chapter</p>
                <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                  <SelectTrigger><SelectValue placeholder="Pick chapter..." /></SelectTrigger>
                  <SelectContent>
                    {chapters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} – {c.chapter_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleSyncChapter} disabled={syncing || !selectedChapterId || !activeTemplate}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Sync Chapter
                </Button>
              </div>

              {/* Sync all */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Sync All Assets</p>
                <p className="text-xs text-muted-foreground">{assets.length} assets with sheets</p>
                <Button size="sm" variant="destructive" onClick={handleSyncAll} disabled={syncing || !activeTemplate}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Sync All ({assets.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Log */}
        {syncLog && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {syncLog.success === false || syncLog.error ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                Sync Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground bg-muted p-4 rounded-md">
                  {JSON.stringify(syncLog, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
