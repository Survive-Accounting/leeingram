import { useState, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePasteArea } from "./ImagePasteArea";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSaved?: () => void;
}

export function ClipboardIntakePanel({ onSaved }: Props) {
  const qc = useQueryClient();
  const [problemFiles, setProblemFiles] = useState<File[]>([]);
  const [solutionFiles, setSolutionFiles] = useState<File[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("course_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-for-intake", courseId],
    queryFn: async () => {
      let q = supabase.from("chapters").select("*").order("chapter_number");
      if (courseId) q = q.eq("course_id", courseId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const uploadFile = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name?.split(".").pop() || "png";
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("problem-assets").upload(path, file, {
      contentType: file.type,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("problem-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!courseId || !chapterId) throw new Error("Select a course and chapter");
      if (problemFiles.length === 0) throw new Error("Paste at least a problem screenshot");

      const problemUrl = await uploadFile(problemFiles[0], "intake-problems");
      let solutionUrl: string | null = null;
      if (solutionFiles.length > 0) {
        solutionUrl = await uploadFile(solutionFiles[0], "intake-solutions");
      }

      const { error } = await supabase.from("chapter_problems").insert({
        course_id: courseId,
        chapter_id: chapterId,
        problem_type: "exercise" as const,
        source_label: "",
        title: "",
        problem_text: "",
        solution_text: "",
        status: "raw",
        problem_screenshot_url: problemUrl,
        solution_screenshot_url: solutionUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      setProblemFiles([]);
      setSolutionFiles([]);
      toast.success("Source item saved to Raw Intake Queue");
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleProblemAdd = useCallback((files: File[]) => {
    setProblemFiles(files.slice(0, 1));
  }, []);

  const handleSolutionAdd = useCallback((files: File[]) => {
    setSolutionFiles(files.slice(0, 1));
  }, []);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Clipboard Intake</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Course</Label>
          <Select value={courseId} onValueChange={(v) => { setCourseId(v); setChapterId(""); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select course" /></SelectTrigger>
            <SelectContent>
              {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Chapter</Label>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent>
              {chapters?.filter((c) => !courseId || c.course_id === courseId).map((c) => (
                <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Problem Screenshot</Label>
          <ImagePasteArea
            label="Paste or drop problem image (Ctrl+V)"
            files={problemFiles}
            onAdd={handleProblemAdd}
            onRemove={() => setProblemFiles([])}
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Solution Screenshot</Label>
          <ImagePasteArea
            label="Paste or drop solution image (Ctrl+V)"
            files={solutionFiles}
            onAdd={handleSolutionAdd}
            onRemove={() => setSolutionFiles([])}
          />
        </div>
      </div>

      <Button
        size="sm"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || problemFiles.length === 0 || !courseId || !chapterId}
      >
        {saveMutation.isPending ? (
          <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</>
        ) : (
          <><Upload className="h-3.5 w-3.5 mr-1" /> Save to Raw Queue</>
        )}
      </Button>
    </div>
  );
}
