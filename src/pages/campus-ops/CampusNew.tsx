import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon } from "lucide-react";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default function CampusNew() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [domains, setDomains] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [semStart, setSemStart] = useState<Date | undefined>(new Date());
  const [semEnd, setSemEnd] = useState<Date | undefined>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 4); return d;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slugManual) setSlug(toSlug(name));
  }, [name, slugManual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) { toast.error("Name and slug are required"); return; }
    setSaving(true);
    const domainsArr = domains.split(",").map(d => d.trim()).filter(Boolean);
    const { error } = await supabase.from("campuses").insert({
      name: name.trim(),
      slug: slug.trim(),
      domains: domainsArr,
      is_active: isActive,
      semester_start: semStart ? format(semStart, "yyyy-MM-dd") : null,
      semester_end: semEnd ? format(semEnd, "yyyy-MM-dd") : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campus created");
    navigate("/campus-ops/campuses");
  };

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate("/campus-ops/campuses")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Campuses
      </button>
      <h1 className="text-lg font-semibold mb-6">Add Campus</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Full Name *</Label>
          <Input placeholder="University of Mississippi" value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Slug *</Label>
          <Input
            placeholder="ole-miss"
            value={slug}
            onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Auto-generated from name. Edit to override.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Domains</Label>
          <Input placeholder="olemiss.edu, go.olemiss.edu" value={domains} onChange={e => setDomains(e.target.value)} />
          <p className="text-xs text-muted-foreground">Comma-separated .edu domains for auto-matching.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <DateField label="Semester Start" date={semStart} onSelect={setSemStart} />
          <DateField label="Semester End" date={semEnd} onSelect={setSemEnd} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label className="cursor-pointer">Active</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Creating…" : "Create Campus"}
        </Button>
      </form>
    </div>
  );
}

function DateField({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}
