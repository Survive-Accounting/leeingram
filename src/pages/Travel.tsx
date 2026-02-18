import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DomainLayout } from "@/components/DomainLayout";
import { Plus, MapPin, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function Travel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ location: "", description: "", start_date: "", end_date: "", year_only: "" });

  const { data: trips } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createTrip = useMutation({
    mutationFn: async () => {
      const startDate = form.start_date || (form.year_only ? `${form.year_only}-01-01` : null);
      const { error } = await supabase.from("trips").insert({ user_id: user!.id, location: form.location, description: form.description || (form.year_only && !form.start_date ? form.year_only : null), start_date: startDate, end_date: form.end_date || null });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trips"] }); setForm({ location: "", description: "", start_date: "", end_date: "", year_only: "" }); setOpen(false); },
  });

  const deleteTrip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });

  const formatDate = (d: string | null) => {
    if (!d) return null;
    try { return format(new Date(d + "T00:00:00"), "MMM d, yyyy"); } catch { return d; }
  };

  return (
    <DomainLayout
      title="Travel"
      tagline="Adventures & trip planning"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20"><Plus className="mr-1 h-4 w-4" /> New Trip</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Plan a Trip</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Mexico City, Mexico" /></div>
              <div><Label>Description (optional)</Label><Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's this trip about?" /></div>
              <div><Label>Year only (if you don't know exact dates)</Label><Input value={form.year_only} onChange={(e) => setForm(p => ({ ...p, year_only: e.target.value, start_date: "", end_date: "" }))} placeholder="e.g. 2022" maxLength={4} /></div>
              {!form.year_only && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                  <div><Label>End Date (optional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
                </div>
              )}
              <Button onClick={() => form.location && createTrip.mutate()} disabled={!form.location || createTrip.isPending} className="w-full">{createTrip.isPending ? "Creating..." : "Create Trip"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="max-w-2xl mx-auto">
        {!trips?.length ? (
          <div className="text-center py-16">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-white/20" />
            <p className="text-white/50">No trips yet. Start planning your next adventure.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {trips.map((trip: any) => (
              <div key={trip.id} className="rounded-lg p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-1 text-white/40 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-white">{trip.location}</h3>
                      {trip.description && <p className="text-sm text-white/50 mt-0.5">{trip.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-white/40">
                        <Calendar className="h-3 w-3" />
                        {formatDate(trip.start_date)
                          ? `${formatDate(trip.start_date)}${trip.end_date ? ` → ${formatDate(trip.end_date)}` : " → Open-ended"}`
                          : "No dates set"}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-red-400 hover:bg-transparent" onClick={() => deleteTrip.mutate(trip.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DomainLayout>
  );
}
