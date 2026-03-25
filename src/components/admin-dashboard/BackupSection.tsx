import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function BackupSection() {
  const [running, setRunning] = useState(false);
  const [lastFolderId, setLastFolderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["backup-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["last_backup_at", "last_backup_folder_name"]);
      const map: Record<string, string | null> = {};
      for (const r of data || []) map[r.key] = r.value;
      return map;
    },
  });

  const runBackup = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-gdrive");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastFolderId(data.google_drive_folder_id);
      queryClient.invalidateQueries({ queryKey: ["backup-settings"] });
      toast.success(`Backup complete: ${data.backup_folder}`, {
        description: `${data.chapters_backed_up} chapters, ${data.quiz_questions} quiz questions`,
        duration: 8000,
      });
    } catch (e: any) {
      toast.error("Backup failed", {
        description: e.message || "Check that GOOGLE_SERVICE_ACCOUNT_JSON and GDRIVE_BACKUP_FOLDER_ID secrets are configured.",
        duration: 10000,
      });
    } finally {
      setRunning(false);
    }
  };

  const lastAt = settings?.last_backup_at;
  const lastFolder = settings?.last_backup_folder_name;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="h-4 w-4" /> Backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Button onClick={runBackup} disabled={running} size="sm">
            {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : "Run Backup Now"}
          </Button>
          {lastFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${lastFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Open in Drive <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {lastAt && (
          <p className="text-xs text-muted-foreground">
            Last backup: <span className="text-foreground">{lastFolder || "—"}</span>{" "}
            on {new Date(lastAt).toLocaleDateString()} at {new Date(lastAt).toLocaleTimeString()}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground/70">
          Backups run automatically every Sunday at 6 AM UTC
        </p>
      </CardContent>
    </Card>
  );
}
