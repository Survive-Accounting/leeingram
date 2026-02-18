import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DomainLayout } from "@/components/DomainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FileText, Upload, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

export default function Writing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: ideas, isLoading } = useQuery({
    queryKey: ["story-ideas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("story_ideas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: uploads } = useQuery({
    queryKey: ["story-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("story_uploads").select("*").order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("story_ideas").insert({ user_id: user!.id, title: newTitle, description: newDesc });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["story-ideas"] });
      toast.success("Story idea created!");
      setShowCreate(false); setNewTitle(""); setNewDesc("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("story_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["story-ideas"] }); toast.success("Deleted"); },
  });

  const handleUpload = async (storyId: string, file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Only PDF files are supported"); return; }
    setUploading(true);
    try {
      const path = `${user!.id}/${storyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("story-files").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("story-files").getPublicUrl(path);
      const { error: dbError } = await supabase.from("story_uploads").insert({ story_idea_id: storyId, user_id: user!.id, file_name: file.name, file_url: urlData.publicUrl });
      if (dbError) throw dbError;
      queryClient.invalidateQueries({ queryKey: ["story-uploads"] });
      toast.success("PDF uploaded!");
    } catch (e: any) { toast.error("Upload failed: " + e.message); }
    finally { setUploading(false); }
  };

  const getUploads = (storyId: string) => uploads?.filter((u) => u.story_idea_id === storyId) ?? [];

  return (
    <DomainLayout
      title="Writing"
      tagline="No destination"
      actions={<Button size="sm" className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-3.5 w-3.5" /> New Story Idea</Button>}
    >
      {isLoading ? (
        <p className="text-sm text-white/50">Loading...</p>
      ) : !ideas?.length ? (
        <div className="flex flex-col items-center py-16 text-center">
          <FileText className="h-12 w-12 text-white/20 mb-4" />
          <p className="text-white/50 mb-4">No story ideas yet.</p>
          <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Your First Story Idea
          </Button>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl mx-auto">
          {ideas.map((idea) => {
            const ideaUploads = getUploads(idea.id);
            const isExpanded = expandedId === idea.id;
            return (
              <div key={idea.id} className="rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button className="flex-1 text-left" onClick={() => setExpandedId(isExpanded ? null : idea.id)}>
                      <h3 className="text-sm font-semibold text-white">{idea.title}</h3>
                      {idea.description && <p className="text-xs text-white/50 mt-0.5">{idea.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{ideaUploads.length} PDF{ideaUploads.length !== 1 ? "s" : ""}</span>
                        <span className="text-xs text-white/40">Created {format(new Date(idea.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/50 hover:text-red-400 hover:bg-transparent" onClick={() => deleteMutation.mutate(idea.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
                      <div>
                        <label htmlFor={`upload-${idea.id}`} className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-white/70 hover:text-white">
                          <Upload className="h-3.5 w-3.5" />
                          {uploading ? "Uploading..." : "Upload PDF"}
                        </label>
                        <input id={`upload-${idea.id}`} type="file" accept=".pdf" className="hidden" disabled={uploading}
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(idea.id, file); e.target.value = ""; }} />
                      </div>
                      {ideaUploads.length > 0 ? (
                        <div className="space-y-1.5">
                          {ideaUploads.map((u) => (
                            <div key={u.id} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.05)" }}>
                              <FileText className="h-3.5 w-3.5 text-white/40" />
                              <a href={u.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-white/70 hover:text-white truncate">{u.file_name}</a>
                              <span className="flex items-center gap-1 text-white/40 shrink-0"><CalendarDays className="h-3 w-3" />{format(new Date(u.uploaded_at), "MMM d, yyyy")}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-white/40">No uploads yet.</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Story Idea</DialogTitle>
            <DialogDescription>What are you writing about?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. The Midnight Librarian" /></div>
            <div className="space-y-1.5"><Label>Description (optional)</Label><Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Brief notes about this story..." /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!newTitle.trim()}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DomainLayout>
  );
}
