import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, RefreshCw } from "lucide-react";

type PurposeRow = {
  id: string; chapter_id: string; purpose_text: string; consequence_text: string;
  is_approved: boolean; generated_at: string | null;
};

export function PurposeTab({ chapterId, chapterName, courseCode }: { chapterId: string; chapterName: string; courseCode: string }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: purpose, refetch } = useQuery({
    queryKey: ["cqa-purpose", chapterId],
    queryFn: async () => {
      const { data } = await supabase.from("chapter_purpose").select("*").eq("chapter_id", chapterId).maybeSingle();
      return data as PurposeRow | null;
    },
  });

  const [purposeText, setPurposeText] = useState("");
  const [consequenceText, setConsequenceText] = useState("");

  useEffect(() => {
    setPurposeText(purpose?.purpose_text || "");
    setConsequenceText(purpose?.consequence_text || "");
  }, [purpose]);

  const invalidate = () => { refetch(); };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-chapter-content-suite", {
        body: { chapterId, chapterName, courseCode, only: "purpose" },
      });
      if (error) throw error;
      toast.success("Purpose generated.");
      invalidate();
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!purpose) return;
    const { error } = await supabase.from("chapter_purpose").update({
      purpose_text: purposeText,
      consequence_text: consequenceText,
    }).eq("id", purpose.id);
    if (error) { toast.error("Save failed"); return; }
    toast.success("Purpose saved.");
    invalidate();
  };

  const handleApprove = async () => {
    if (!purpose) return;
    await supabase.from("chapter_purpose").update({ is_approved: true }).eq("id", purpose.id);
    toast.success("Purpose approved.");
    invalidate();
  };

  const hasChanges = purpose && (purposeText !== purpose.purpose_text || consequenceText !== purpose.consequence_text);

  if (!purpose && !generating) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-sm text-muted-foreground">No chapter purpose generated yet.</p>
        <Button onClick={handleGenerate} disabled={generating}><Sparkles className="h-4 w-4 mr-2" /> Generate Purpose →</Button>
      </div>
    );
  }

  if (!purpose) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 pb-10">
      <Card className="border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Chapter Purpose</span>
            {purpose.is_approved
              ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5">Approved ✓</Badge>
              : <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>
            }
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Why this chapter matters:</label>
            <Textarea value={purposeText} onChange={(e) => setPurposeText(e.target.value)} rows={4} className="text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">What goes wrong if ignored:</label>
            <Textarea value={consequenceText} onChange={(e) => setConsequenceText(e.target.value)} rows={3} className="text-sm" />
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button size="sm" onClick={handleSave}><Check className="h-3.5 w-3.5 mr-1" /> Save Changes</Button>
            )}
            {!purpose.is_approved && (
              <Button size="sm" variant="outline" onClick={handleApprove}><Check className="h-3.5 w-3.5 mr-1" /> Approve ✓</Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generating} className="ml-auto">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
