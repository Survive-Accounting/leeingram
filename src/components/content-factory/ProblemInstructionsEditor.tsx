import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Instruction = {
  id?: string;
  instruction_number: number;
  instruction_text: string;
};

interface ProblemInstructionsEditorProps {
  assetId: string;
  problemContext: string;
  onUpdated?: () => void;
}

export default function ProblemInstructionsEditor({
  assetId,
  problemContext: initialContext,
  onUpdated,
}: ProblemInstructionsEditorProps) {
  const [context, setContext] = useState(initialContext || "");
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setContext(initialContext || "");
  }, [initialContext]);

  useEffect(() => {
    if (!assetId) return;
    supabase
      .from("problem_instructions")
      .select("id, instruction_number, instruction_text")
      .eq("teaching_asset_id", assetId)
      .order("instruction_number")
      .then(({ data }) => {
        setInstructions(
          data && data.length > 0
            ? data.map((d) => ({
                id: d.id,
                instruction_number: d.instruction_number,
                instruction_text: d.instruction_text,
              }))
            : []
        );
        setLoaded(true);
      });
  }, [assetId]);

  const addInstruction = () => {
    const nextNum = instructions.length > 0
      ? Math.max(...instructions.map((i) => i.instruction_number)) + 1
      : 1;
    setInstructions([...instructions, { instruction_number: nextNum, instruction_text: "" }]);
  };

  const removeInstruction = (idx: number) => {
    setInstructions(instructions.filter((_, i) => i !== idx));
  };

  const updateInstruction = (idx: number, text: string) => {
    setInstructions(instructions.map((inst, i) => (i === idx ? { ...inst, instruction_text: text } : inst)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save problem_context
      const { error: ctxErr } = await supabase
        .from("teaching_assets")
        .update({ problem_context: context } as any)
        .eq("id", assetId);
      if (ctxErr) throw ctxErr;

      // Delete existing instructions then re-insert
      await supabase
        .from("problem_instructions")
        .delete()
        .eq("teaching_asset_id", assetId);

      if (instructions.length > 0) {
        const rows = instructions.map((inst, idx) => ({
          teaching_asset_id: assetId,
          instruction_number: idx + 1,
          instruction_text: inst.instruction_text,
        }));
        const { error: insErr } = await supabase
          .from("problem_instructions")
          .insert(rows);
        if (insErr) throw insErr;
      }

      toast.success("Problem context & instructions saved");
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      {/* Problem Context */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
          Problem Context
        </p>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Enter the descriptive scenario / background information for this problem..."
          className="min-h-[100px] text-sm"
        />
      </div>

      {/* Instructions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Instructions
          </p>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={addInstruction}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        {instructions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No instructions added yet.</p>
        ) : (
          <div className="space-y-2">
            {instructions.map((inst, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs font-mono font-bold text-primary mt-2.5 w-5 shrink-0 text-right">
                  {idx + 1}
                </span>
                <Input
                  value={inst.instruction_text}
                  onChange={(e) => updateInstruction(idx, e.target.value)}
                  placeholder={`Instruction ${idx + 1}`}
                  className="text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeInstruction(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
        {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
        Save Context & Instructions
      </Button>
    </div>
  );
}
