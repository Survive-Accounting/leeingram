import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DomainLayout } from "@/components/DomainLayout";
import { Plus, MapPin, Calendar, Trash2, ChevronDown, Pencil, ClipboardList, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEASONS = ["Winter", "Spring", "Summer", "Fall"] as const;

const seasonToDate = (season: string, year: string): { start: string; end: string } => {
  const y = parseInt(year);
  switch (season) {
    case "Winter": return { start: `${y}-01-01`, end: `${y}-03-31` };
    case "Spring": return { start: `${y}-04-01`, end: `${y}-06-30` };
    case "Summer": return { start: `${y}-07-01`, end: `${y}-09-30` };
    case "Fall": return { start: `${y}-10-01`, end: `${y}-12-31` };
    default: return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
};

const dateToSeason = (startDate: string | null): string => {
  if (!startDate) return "";
  const month = parseInt(startDate.substring(5, 7));
  if (month <= 3) return "Winter";
  if (month <= 6) return "Spring";
  if (month <= 9) return "Summer";
  return "Fall";
};

const getSeasonDisplay = (trip: any): string => {
  if (!trip.start_date) return "No dates set";
  const year = trip.start_date.substring(0, 4);
  const startMonth = parseInt(trip.start_date.substring(5, 7));
  const endMonth = trip.end_date ? parseInt(trip.end_date.substring(5, 7)) : null;
  // Full year (Jan–Dec)
  if (startMonth === 1 && endMonth === 12) return year;
  const season = dateToSeason(trip.start_date);
  return `${season} ${year}`;
};

export default function Travel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);
  const [form, setForm] = useState({ location: "", description: "", season: "", year: "" });
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);

  const { data: trips } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").order("start_date", { ascending: true, nullsFirst: true });
      return data || [];
    },
  });

  const createTrip = useMutation({
    mutationFn: async () => {
      let startDate: string | null = null;
      let endDate: string | null = null;
      if (form.year) {
        if (form.season) {
          const dates = seasonToDate(form.season, form.year);
          startDate = dates.start;
          endDate = dates.end;
        } else {
          startDate = `${form.year}-01-01`;
          endDate = `${form.year}-12-31`;
        }
      }
      const { error } = await supabase.from("trips").insert({ user_id: user!.id, location: form.location, description: form.description || null, start_date: startDate, end_date: endDate });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trips"] }); resetForm(); },
  });

  const updateTrip = useMutation({
    mutationFn: async () => {
      if (!editingTrip) return;
      let startDate: string | null = null;
      let endDate: string | null = null;
      if (form.year) {
        if (form.season) {
          const dates = seasonToDate(form.season, form.year);
          startDate = dates.start;
          endDate = dates.end;
        } else {
          startDate = `${form.year}-01-01`;
          endDate = `${form.year}-12-31`;
        }
      }
      const { error } = await supabase.from("trips").update({ location: form.location, description: form.description || null, start_date: startDate, end_date: endDate }).eq("id", editingTrip.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trips"] }); resetForm(); },
  });

  const deleteTrip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });

  const resetForm = () => { setForm({ location: "", description: "", season: "", year: "" }); setEditingTrip(null); setOpen(false); };

  const startEdit = (trip: any) => {
    setEditingTrip(trip);
    const year = trip.start_date?.substring(0, 4) || "";
    const startMonth = trip.start_date ? parseInt(trip.start_date.substring(5, 7)) : 0;
    const endMonth = trip.end_date ? parseInt(trip.end_date.substring(5, 7)) : 0;
    const isFullYear = startMonth === 1 && endMonth === 12;
    setForm({
      location: trip.location,
      description: trip.description || "",
      year,
      season: isFullYear ? "" : dateToSeason(trip.start_date),
    });
    setOpen(true);
  };

  const now = new Date().toISOString().split("T")[0];
  const upcoming = trips?.filter((t: any) => !t.end_date || t.end_date >= now) || [];
  const past = trips?.filter((t: any) => t.end_date && t.end_date < now) || [];

  const TripCard = ({ trip, upcoming = false }: { trip: any; upcoming?: boolean }) => (
    <div
      className={`rounded-lg p-5 transition-all duration-300 ${upcoming ? "shadow-[0_0_20px_rgba(140,180,255,0.12)] border-[rgba(140,180,255,0.25)]" : ""}`}
      style={{
        background: upcoming ? "rgba(140,180,255,0.08)" : "rgba(255,255,255,0.06)",
        border: upcoming ? undefined : "1px solid rgba(255,255,255,0.1)",
        borderWidth: upcoming ? "1px" : undefined,
        borderStyle: upcoming ? "solid" : undefined,
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <MapPin className="h-4 w-4 mt-1 text-white/40 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">{trip.location}</h3>
            {trip.description && <p className="text-sm text-white/50 mt-0.5">{trip.description}</p>}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-white/40">
              <Calendar className="h-3 w-3" />
              {getSeasonDisplay(trip)}
            </div>
            {/* Planning & Exploring buttons */}
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" className="h-7 text-xs bg-white/5 border-white/20 text-white/70 hover:text-white hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); navigate(`/travel/${trip.id}/planning`); }}>
                <ClipboardList className="mr-1 h-3 w-3" /> Planning Dashboard
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-white/5 border-white/20 text-white/70 hover:text-white hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); navigate(`/travel/${trip.id}/exploring`); }}>
                <Compass className="mr-1 h-3 w-3" /> Exploring
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white/70 hover:bg-transparent" onClick={() => startEdit(trip)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-transparent" onClick={() => deleteTrip.mutate(trip.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  const SectionHeader = ({ label, count, isOpen, onToggle }: { label: string; count: number; isOpen: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className="flex items-center gap-2 w-full text-left mb-3">
      <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
      <span className="text-sm font-medium text-white/70">{label}</span>
      <span className="text-xs text-white/30">({count})</span>
    </button>
  );

  return (
    <DomainLayout
      title="Travel"
      tagline="Adventures & trip planning"
      actions={
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(v); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20"><Plus className="mr-1 h-4 w-4" /> New Trip</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTrip ? "Edit Trip" : "Log a Trip"}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Mexico City, Mexico" /></div>
              <div><Label>Description (optional)</Label><Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's this trip about?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Season (optional)</Label>
                  <Select value={form.season} onValueChange={(v) => setForm(p => ({ ...p, season: v }))}>
                    <SelectTrigger><SelectValue placeholder="Any / All year" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All year</SelectItem>
                      {SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input value={form.year} onChange={(e) => setForm(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2022" maxLength={4} />
                </div>
              </div>
              {editingTrip ? (
                <Button onClick={() => form.location && updateTrip.mutate()} disabled={!form.location || updateTrip.isPending} className="w-full">{updateTrip.isPending ? "Saving..." : "Save Changes"}</Button>
              ) : (
                <Button onClick={() => form.location && createTrip.mutate()} disabled={!form.location || createTrip.isPending} className="w-full">{createTrip.isPending ? "Creating..." : "Add Trip"}</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {!trips?.length ? (
          <div className="text-center py-16">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-white/20" />
            <p className="text-white/50">No trips yet. Start logging your adventures.</p>
          </div>
        ) : (
          <>
            {past.length > 0 && (
              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <SectionHeader label="Past Trips" count={past.length} isOpen={pastOpen} onToggle={() => setPastOpen(o => !o)} />
                <CollapsibleContent>
                  <div className="grid gap-3">{past.map((t: any) => <TripCard key={t.id} trip={t} />)}</div>
                </CollapsibleContent>
              </Collapsible>
            )}
            {upcoming.length > 0 && (
              <Collapsible open={upcomingOpen} onOpenChange={setUpcomingOpen}>
                <SectionHeader label="Upcoming Trips" count={upcoming.length} isOpen={upcomingOpen} onToggle={() => setUpcomingOpen(o => !o)} />
                <CollapsibleContent>
                  <div className="grid gap-3">{upcoming.map((t: any) => <TripCard key={t.id} trip={t} upcoming />)}</div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </DomainLayout>
  );
}
