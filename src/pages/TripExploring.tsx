import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainLayout } from "@/components/DomainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, Trash2, ExternalLink, Pencil, X } from "lucide-react";
import { toast } from "sonner";

const EXPLORE_CATEGORIES = [
  { value: "restaurants", label: "🍽️ Restaurants" },
  { value: "coffee", label: "☕ Coffee Shops" },
  { value: "beaches", label: "🏖️ Beaches" },
  { value: "excursions", label: "🥾 Excursions" },
  { value: "weekend_trips", label: "🚗 Weekend Trips" },
  { value: "date_night", label: "💃 Date Night Ideas" },
];

export default function TripExploring() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "restaurants", url: "" });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(EXPLORE_CATEGORIES.map(c => [c.value, true]))
  );

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data } = await supabase.from("trips").select("*").eq("id", tripId!).single();
      return data;
    },
    enabled: !!tripId,
  });

  const { data: items } = useQuery({
    queryKey: ["trip-explore", tripId],
    queryFn: async () => {
      const { data } = await supabase.from("trip_explore_items").select("*").eq("trip_id", tripId!).order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!tripId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trip_explore_items").insert({
        trip_id: tripId!, user_id: user!.id, title: form.title,
        description: form.description, category: form.category, url: form.url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-explore", tripId] }); resetForm(); toast.success("Added!"); },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      const { error } = await supabase.from("trip_explore_items").update({
        title: form.title, description: form.description, category: form.category, url: form.url || null,
      }).eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-explore", tripId] }); resetForm(); toast.success("Updated!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("trip_explore_items").delete().eq("id", id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trip-explore", tripId] }); toast.success("Removed"); },
  });

  const resetForm = () => { setForm({ title: "", description: "", category: "restaurants", url: "" }); setEditingItem(null); setShowCreate(false); };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description || "", category: item.category, url: item.url || "" });
    setShowCreate(true);
  };

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const item of (items || [])) {
      if (!g[item.category]) g[item.category] = [];
      g[item.category].push(item);
    }
    return g;
  }, [items]);

  return (
    <DomainLayout
      title={trip?.location ? `${trip.location} — Exploring` : "Exploring"}
      tagline="Places to discover"
      actions={
        <Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Place
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto space-y-3">
        {EXPLORE_CATEGORIES.map(cat => {
          const catItems = grouped[cat.value] || [];
          return (
            <Collapsible key={cat.value} open={openSections[cat.value]} onOpenChange={v => setOpenSections(p => ({ ...p, [cat.value]: v }))}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${openSections[cat.value] ? "" : "-rotate-90"}`} />
                <span className="text-sm font-medium text-white/80">{cat.label}</span>
                <span className="text-xs text-white/30">({catItems.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 pl-4 pb-2">
                  {catItems.length === 0 ? (
                    <p className="text-xs text-white/30 py-2">No places added yet</p>
                  ) : catItems.map(item => (
                    <div key={item.id} className="group flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        {item.description && <p className="text-xs text-white/50 mt-0.5">{item.description}</p>}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline">
                            <ExternalLink className="h-2.5 w-2.5" /> Link
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-white" onClick={() => startEdit(item)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-red-400" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <Dialog open={showCreate} onOpenChange={v => { if (!v) resetForm(); else setShowCreate(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Edit Place" : "Add a Place"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Name</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Café Punto" /></div>
            <div><Label>Description (optional)</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Quick note..." /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPLORE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Link (optional)</Label><Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
            {editingItem ? (
              <Button onClick={() => form.title && updateMutation.mutate()} disabled={!form.title || updateMutation.isPending} className="w-full">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => form.title && createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Adding..." : "Add Place"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DomainLayout>
  );
}
