import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCcw, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface ResetSummary {
  variants_to_archive: number;
  teaching_assets_to_archive: number;
  sheet_links_to_clear: number;
  source_problems_to_reset: number;
  drive_sheets_to_archive: number;
}

export function PipelineResetDialog() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [archiveDrive, setArchiveDrive] = useState(false);
  const [summary, setSummary] = useState<ResetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [pwError, setPwError] = useState(false);

  const fetchSummary = async () => {
    if (!password) return;
    setLoading(true);
    setPwError(false);
    try {
      const { data, error } = await supabase.functions.invoke("reset-pipeline", {
        body: { password, dry_run: true, archive_drive_sheets: archiveDrive },
      });
      if (error) throw error;
      if (data?.error) {
        setPwError(true);
        return;
      }
      setSummary(data.summary);
      setPasswordOpen(false);
      setConfirmOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch summary");
    } finally {
      setLoading(false);
    }
  };

  const executeReset = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-pipeline", {
        body: { password, dry_run: false, archive_drive_sheets: archiveDrive },
      });
      if (error) throw error;
      if (data?.errors) {
        toast.error(`Reset completed with errors: ${data.errors.join(", ")}`);
      } else {
        const driveMsg = data?.summary?.drive_sheets_archived
          ? ` ${data.summary.drive_sheets_archived} Drive sheets archived.`
          : "";
        toast.success(`Pipeline reset complete.${driveMsg} Ready for fresh test run.`);
      }
      setConfirmOpen(false);
      setPassword("");
      setSummary(null);
      setArchiveDrive(false);
    } catch (e: any) {
      toast.error(e.message || "Reset failed");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="text-xs"
        onClick={() => { setPasswordOpen(true); setPassword(""); setPwError(false); setArchiveDrive(false); }}
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        Reset Pipeline
      </Button>

      {/* Password gate */}
      <AlertDialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Admin Authentication Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will archive all pipeline outputs. Enter the admin password to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Admin Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(false); }}
                placeholder="Enter password…"
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && fetchSummary()}
              />
              {pwError && (
                <p className="text-xs text-destructive">Invalid password. Access denied.</p>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 p-2.5">
              <Checkbox
                id="archive-drive"
                checked={archiveDrive}
                onCheckedChange={(v) => setArchiveDrive(!!v)}
              />
              <div>
                <label htmlFor="archive-drive" className="text-xs font-medium text-foreground cursor-pointer">
                  Also archive Google Drive sheets
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Moves all spreadsheets in chapter folders to Archive subfolders in Google Drive
                </p>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={fetchSummary} disabled={!password || loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Verify & Preview
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation with summary */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Confirm Pipeline Reset
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The following items will be affected:</p>
                {summary && (
                  <div className="rounded-md border border-border bg-secondary/50 p-3 space-y-1.5 text-sm font-mono">
                    <div className="flex justify-between">
                      <span>Variants to archive:</span>
                      <span className="font-bold text-foreground">{summary.variants_to_archive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Teaching assets to archive:</span>
                      <span className="font-bold text-foreground">{summary.teaching_assets_to_archive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sheet links to clear:</span>
                      <span className="font-bold text-foreground">{summary.sheet_links_to_clear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Source problems to reset:</span>
                      <span className="font-bold text-foreground">{summary.source_problems_to_reset}</span>
                    </div>
                    {summary.drive_sheets_to_archive > 0 && (
                      <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                        <span>Drive sheets to archive:</span>
                        <span className="font-bold text-foreground">{summary.drive_sheets_to_archive}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  ✅ Source problems, solutions, screenshots, and import data will NOT be touched.
                </p>
                {summary && summary.drive_sheets_to_archive > 0 && (
                  <p className="text-xs text-muted-foreground">
                    📁 Drive sheets will be moved to Archive subfolders (not deleted).
                  </p>
                )}
                <p className="font-semibold text-destructive">This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={executeReset} disabled={executing}>
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Execute Reset
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
