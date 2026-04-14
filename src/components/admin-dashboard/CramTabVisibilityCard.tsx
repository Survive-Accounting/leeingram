import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Eye } from "lucide-react";
import { isWhitelistedEmail } from "@/lib/emailWhitelist";
import { useAuth } from "@/contexts/AuthContext";

const TAB_DISPLAY: { key: string; label: string }[] = [
  { key: "the_why", label: "The Why" },
  { key: "key_terms", label: "Key Terms" },
  { key: "accounts", label: "Accounts" },
  { key: "journal_entries", label: "Journal Entries" },
  { key: "formulas", label: "Formulas" },
  { key: "exam_mistakes", label: "Exam Mistakes" },
  { key: "memory", label: "Memory" },
];

type VisRow = { tab_name: string; is_visible: boolean };

export function CramTabVisibilityCard() {
  const { user } = useAuth();
  const isLee = !!user?.email && isWhitelistedEmail(user.email) && user.email === "lee@survivestudios.com";
  const qc = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["cram-tab-visibility"],
    queryFn: async () => {
      const { data } = await supabase.from("cram_tab_visibility").select("tab_name, is_visible");
      return (data || []) as VisRow[];
    },
  });

  const [local, setLocal] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (rows) {
      const map: Record<string, boolean> = {};
      rows.forEach(r => { map[r.tab_name] = r.is_visible; });
      setLocal(map);
    }
  }, [rows]);

  const handleToggle = async (tabName: string, label: string) => {
    if (!isLee) {
      toast.error("Access Restricted — Message Lee on Slack");
      return;
    }
    const newVal = !local[tabName];
    // Optimistic
    setLocal(prev => ({ ...prev, [tabName]: newVal }));

    const { error } = await supabase
      .from("cram_tab_visibility")
      .update({ is_visible: newVal, updated_at: new Date().toISOString() } as any)
      .eq("tab_name", tabName);

    if (error) {
      // Revert
      setLocal(prev => ({ ...prev, [tabName]: !newVal }));
      toast.error("Failed to update visibility");
      return;
    }

    toast.success(newVal ? `${label} visible to students` : `${label} hidden from students`);
    qc.invalidateQueries({ queryKey: ["cram-tab-visibility"] });
  };

  return (
    <Card className="border-border overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: "#14213D" }}>
        <Eye className="h-4 w-4 text-white/70" />
        <div>
          <p className="text-sm font-semibold text-white">Cram Tool Visibility</p>
          <p className="text-[10px] text-white/60">Hide or show tabs across all chapters. Hidden tabs are invisible to students — no data is deleted.</p>
        </div>
      </div>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="divide-y divide-border">
            {TAB_DISPLAY.map(({ key, label }) => {
              const visible = local[key] ?? true;
              return (
                <div key={key} className="flex items-center justify-between px-4 py-2.5">
                  <span className={`text-sm font-medium ${visible ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {label}
                  </span>
                  <Switch
                    checked={visible}
                    onCheckedChange={() => handleToggle(key, label)}
                    disabled={!isLee}
                    className={visible ? "data-[state=checked]:bg-emerald-500" : "data-[state=unchecked]:bg-destructive/50"}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
