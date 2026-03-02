import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Loader2, Building2, Sparkles, AlertTriangle, BookOpen, FileText, Video, X, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Settings = {
  teaching_tone: string[];
  exam_realism: string[];
  variants_per_request: number;
  require_different_values: boolean;
  require_different_company: boolean;
  require_different_scenario: boolean;
  je_answer_only: boolean;
  je_fully_worked: boolean;
  je_google_sheets_format: boolean;
  je_canva_export: boolean;
  default_difficulty: string;
  tricky_partial_period: boolean;
  tricky_missing_info: boolean;
  tricky_sign_reversal: boolean;
  tricky_multi_step_decoy: boolean;
  tricky_numerical_decoys: boolean;
  tricky_je_direction_trap: boolean;
  store_solution_internally: boolean;
  video_linked_explanation: boolean;
  no_written_explanation: boolean;
  use_company_names: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  teaching_tone: [
    "Neutral but memorable",
    "Mix of playful and professional",
    "No Ole Miss references",
    "No campus-specific language",
    "No fluff or storytelling filler",
  ],
  exam_realism: [
    "All generated problems must be exam-style",
    "No bolded numbers",
    "Round all calculations to whole dollars",
    "Use short, concise sentences",
    "No instructional hints embedded in problem text",
  ],
  variants_per_request: 3,
  require_different_values: true,
  require_different_company: true,
  require_different_scenario: true,
  je_answer_only: true,
  je_fully_worked: true,
  je_google_sheets_format: true,
  je_canva_export: true,
  default_difficulty: "standard",
  tricky_partial_period: false,
  tricky_missing_info: false,
  tricky_sign_reversal: false,
  tricky_multi_step_decoy: false,
  tricky_numerical_decoys: false,
  tricky_je_direction_trap: false,
  store_solution_internally: true,
  video_linked_explanation: true,
  no_written_explanation: true,
  use_company_names: true,
};

export default function StyleGuide() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [newToneItem, setNewToneItem] = useState("");
  const [newExamItem, setNewExamItem] = useState("");

  const { data: existing, isLoading } = useQuery({
    queryKey: ["variant-generation-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("variant_generation_settings" as any)
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!session,
  });


  useEffect(() => {
    if (existing) {
      setSettings({
        teaching_tone: Array.isArray(existing.teaching_tone) ? existing.teaching_tone : DEFAULT_SETTINGS.teaching_tone,
        exam_realism: Array.isArray(existing.exam_realism) ? existing.exam_realism : DEFAULT_SETTINGS.exam_realism,
        variants_per_request: existing.variants_per_request ?? 3,
        require_different_values: existing.require_different_values ?? true,
        require_different_company: existing.require_different_company ?? true,
        require_different_scenario: existing.require_different_scenario ?? true,
        je_answer_only: existing.je_answer_only ?? true,
        je_fully_worked: existing.je_fully_worked ?? true,
        je_google_sheets_format: existing.je_google_sheets_format ?? true,
        je_canva_export: existing.je_canva_export ?? true,
        default_difficulty: existing.default_difficulty ?? "standard",
        tricky_partial_period: existing.tricky_partial_period ?? false,
        tricky_missing_info: existing.tricky_missing_info ?? false,
        tricky_sign_reversal: existing.tricky_sign_reversal ?? false,
        tricky_multi_step_decoy: existing.tricky_multi_step_decoy ?? false,
        tricky_numerical_decoys: existing.tricky_numerical_decoys ?? false,
        tricky_je_direction_trap: existing.tricky_je_direction_trap ?? false,
        store_solution_internally: existing.store_solution_internally ?? true,
        video_linked_explanation: existing.video_linked_explanation ?? true,
        no_written_explanation: existing.no_written_explanation ?? true,
        use_company_names: existing.use_company_names ?? true,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...settings, user_id: session!.user.id, updated_at: new Date().toISOString() };
      if (existing) {
        const { error } = await supabase
          .from("variant_generation_settings" as any)
          .update(payload)
          .eq("user_id", session!.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("variant_generation_settings" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-generation-settings"] });
      toast.success("Variant generation settings saved!");
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const removeListItem = (key: "teaching_tone" | "exam_realism", idx: number) => {
    update(key, settings[key].filter((_, i) => i !== idx));
  };

  const addListItem = (key: "teaching_tone" | "exam_realism", value: string) => {
    if (!value.trim()) return;
    update(key, [...settings[key], value.trim()]);
  };

  const SectionTitle = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );

  const ToggleRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-1.5">
      <Label className="text-xs cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );

  const EditableList = ({ items, onRemove, onAdd, newValue, setNewValue, placeholder }: {
    items: string[]; onRemove: (i: number) => void; onAdd: () => void;
    newValue: string; setNewValue: (v: string) => void; placeholder: string;
  }) => (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <span className="text-xs text-foreground flex-1">• {item}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => onRemove(i)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={placeholder} className="h-7 text-xs flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") { onAdd(); setNewValue(""); } }}
        />
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { onAdd(); setNewValue(""); }}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-foreground">Variant Generation Settings</h1>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading} size="sm">
          {saveMutation.isPending ? (
            <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Saving…</>
          ) : (
            <><Save className="mr-1 h-3.5 w-3.5" /> Save All Settings</>
          )}
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        These structured preferences are automatically referenced by the AI Variant Generator for every generation request.
      </p>

      <div className="space-y-5 max-w-2xl">
        {/* Teaching Tone */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={BookOpen} title="Teaching Tone" />
            <EditableList
              items={settings.teaching_tone}
              onRemove={(i) => removeListItem("teaching_tone", i)}
              onAdd={() => { addListItem("teaching_tone", newToneItem); setNewToneItem(""); }}
              newValue={newToneItem}
              setNewValue={setNewToneItem}
              placeholder="Add tone rule…"
            />
          </CardContent>
        </Card>

        {/* Exam Realism Rules */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={FileText} title="Exam Realism Rules" />
            <EditableList
              items={settings.exam_realism}
              onRemove={(i) => removeListItem("exam_realism", i)}
              onAdd={() => { addListItem("exam_realism", newExamItem); setNewExamItem(""); }}
              newValue={newExamItem}
              setNewValue={setNewExamItem}
              placeholder="Add exam rule…"
            />
          </CardContent>
        </Card>

        {/* Default Variant Behavior */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={Sparkles} title="Default Variant Behavior" />
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <Label className="text-xs">Variants per request</Label>
                <Input
                  type="number" min={1} max={5}
                  value={settings.variants_per_request}
                  onChange={(e) => update("variants_per_request", parseInt(e.target.value) || 3)}
                  className="h-7 w-16 text-xs text-center"
                />
              </div>
              <ToggleRow label="Each variant uses different numeric values" checked={settings.require_different_values} onChange={(v) => update("require_different_values", v)} />
              <ToggleRow label="Each variant uses different company name" checked={settings.require_different_company} onChange={(v) => update("require_different_company", v)} />
              <ToggleRow label="Each variant uses different short scenario" checked={settings.require_different_scenario} onChange={(v) => update("require_different_scenario", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Journal Entry Settings */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={FileText} title="Journal Entry Settings" />
            <p className="text-[10px] text-muted-foreground mb-3">Some problems may not require JE. When JE is required:</p>
            <div className="space-y-2">
              <ToggleRow label="Store answer-only JE" checked={settings.je_answer_only} onChange={(v) => update("je_answer_only", v)} />
              <ToggleRow label="Store fully worked solution steps" checked={settings.je_fully_worked} onChange={(v) => update("je_fully_worked", v)} />
              <Separator className="my-2" />
              <p className="text-[10px] text-muted-foreground">Format compatibility:</p>
              <ToggleRow label="Google Sheets copy/paste format" checked={settings.je_google_sheets_format} onChange={(v) => update("je_google_sheets_format", v)} />
              <ToggleRow label="Canva export compatibility (future)" checked={settings.je_canva_export} onChange={(v) => update("je_canva_export", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Difficulty & Trick Settings */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={AlertTriangle} title="Difficulty & Trick Settings" />
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-[10px]">
                Default: {settings.default_difficulty === "standard" ? "Standard Exam Style" : "Tricky"}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">
              When tricky toggles are ON, the AI may incorporate these patterns into generated variants:
            </p>
            <div className="space-y-2">
              <ToggleRow label="Partial period / stub period" checked={settings.tricky_partial_period} onChange={(v) => update("tricky_partial_period", v)} />
              <ToggleRow label="Missing information requiring inference" checked={settings.tricky_missing_info} onChange={(v) => update("tricky_missing_info", v)} />
              <ToggleRow label="Premium vs discount sign reversal traps" checked={settings.tricky_sign_reversal} onChange={(v) => update("tricky_sign_reversal", v)} />
              <ToggleRow label="Multi-step with decoy step" checked={settings.tricky_multi_step_decoy} onChange={(v) => update("tricky_multi_step_decoy", v)} />
              <ToggleRow label="Decoy numerical values" checked={settings.tricky_numerical_decoys} onChange={(v) => update("tricky_numerical_decoys", v)} />
              <ToggleRow label="Journal entry debit/credit direction traps" checked={settings.tricky_je_direction_trap} onChange={(v) => update("tricky_je_direction_trap", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Explanation Output */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={Video} title="Explanation Output" />
            <div className="space-y-2">
              <ToggleRow label="Store solution steps internally" checked={settings.store_solution_internally} onChange={(v) => update("store_solution_internally", v)} />
              <ToggleRow label="Student-facing explanation will be video-linked" checked={settings.video_linked_explanation} onChange={(v) => update("video_linked_explanation", v)} />
              <ToggleRow label="Do not generate written teaching explanation by default" checked={settings.no_written_explanation} onChange={(v) => update("no_written_explanation", v)} />
            </div>
          </CardContent>
        </Card>

        {/* Company Names — Standardized */}
        <Card>
          <CardContent className="pt-5">
            <SectionTitle icon={Building2} title="Company Names" />
            <p className="text-xs text-muted-foreground mb-2">
              All generated variants now use a standardized company name.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Primary</Badge>
                <span className="font-medium">Survive Company</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">Counterparty</Badge>
                <span className="font-medium">Survive Counterparty</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic mt-3">
              The rotating company names library is no longer used. All variants use "Survive Company" for consistency.
            </p>
          </CardContent>
        </Card>
      </div>

    </AppLayout>
  );
}
