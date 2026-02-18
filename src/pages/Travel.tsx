import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, MapPin, Calendar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function Travel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ location: "", description: "", start_date: "", end_date: "" });

  const { data: trips } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").insert({
        user_id: user!.id,
        location: form.location,
        description: form.description,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setForm({ location: "", description: "", start_date: "", end_date: "" });
      setOpen(false);
    },
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
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate("/domains")} className="mb-8 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Domains
        </Button>

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold">Travel</h1>
            <p className="text-muted-foreground mt-1">Adventures & trip planning</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Trip</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Plan a Trip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Mexico City, Mexico" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's this trip about?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End Date (optional)</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={() => form.location && createTrip.mutate()} disabled={!form.location || createTrip.isPending} className="w-full">
                  {createTrip.isPending ? "Creating..." : "Create Trip"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!trips?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No trips yet. Start planning your next adventure.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {trips.map((trip: any) => (
              <Card key={trip.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <div>
                        <h3 className="font-semibold">{trip.location}</h3>
                        {trip.description && <p className="text-sm text-muted-foreground mt-0.5">{trip.description}</p>}
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(trip.start_date)
                            ? `${formatDate(trip.start_date)}${trip.end_date ? ` → ${formatDate(trip.end_date)}` : " → Open-ended"}`
                            : "No dates set"}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteTrip.mutate(trip.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
