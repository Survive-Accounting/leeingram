import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export function BackupSection() {
  const [running, setRunning] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings, refetch } = useQuery({
    queryKey: ["backup-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["last_backup_at", "last_backup_folder_name", "last_backup_folder_id", "backup_status"]);
      const map: Record<string, string | null> = {};
      for (const r of data || []) map[r.key] = r.value;
      return map;
    },
  });

  // Poll while backup is running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("key", "backup_status")
        .single();
      const status = data?.value;
      if (status === "complete") {
        clearInterval(interval);
        setRunning(false);
        queryClient.invalidateQueries({ queryKey: ["backup-settings"] });
        toast.success("Backup complete! Check Google Drive.");
      } else if (status?.startsWith("failed")) {
        clearInterval(interval);
        setRunning(false);
        toast.error("Backup failed", { description: status.replace("failed: ", "") });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [running, queryClient]);

  const runBackup = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-gdrive");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.info("Backup started — this may take a few minutes...");
    } catch (e: any) {
      setRunning(false);
      toast.error("Backup failed to start", {
        description: e.message || "Check that secrets are configured.",
        duration: 10000,
      });
    }
  };

  const lastAt = settings?.last_backup_at;
  const lastFolder = settings?.last_backup_folder_name;
  const lastFolderId = settings?.last_backup_folder_id;
  const backupStatus = settings?.backup_status;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="h-4 w-4" /> Backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={runBackup} disabled={running} size="sm">
            {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : "Run Backup Now"}
          </Button>
          {lastFolderId && !running && (
            <a
              href={`https://drive.google.com/drive/folders/${lastFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Open in Drive <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {backupStatus === "complete" && !running && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Last run succeeded
            </span>
          )}
          {backupStatus?.startsWith("failed") && !running && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {backupStatus.replace("failed: ", "")}
            </span>
          )}
        </div>

        {running && (
          <p className="text-xs text-muted-foreground animate-pulse">
            Backing up database to Google Drive… this may take 1-3 minutes.
          </p>
        )}

        {lastAt && !running && (
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
