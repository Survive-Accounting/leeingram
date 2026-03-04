import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, FileText, Loader2, Check, Archive, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ParsedBlock = {
  id: string;
  source_code: string;
  source_type: string;
  page_start: number | null;
  page_end: number | null;
  cleaned_text: string;
  confidence: number;
  status: string;
};

export default function SolutionsPdfUpload() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*, courses(*)")
        .eq("id", chapterId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  const course = chapter?.courses as { course_name: string; id: string; code: string } | undefined;

  // Fetch uploaded files for this chapter
  const { data: uploadedFiles } = useQuery({
    queryKey: ["uploaded-files", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploaded_files")
        .select("*")
        .eq("chapter_id", chapterId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  // Fetch parsed blocks for active file
  const { data: parsedBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["parsed-blocks", activeFileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parsed_solution_blocks")
        .select("*")
        .eq("file_id", activeFileId!);
      if (error) throw error;
      // Natural sort by source_code
      return (data as ParsedBlock[]).sort((a, b) => {
        return a.source_code.localeCompare(b.source_code, undefined, { numeric: true, sensitivity: "base" });
      });
    },
    enabled: !!activeFileId,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chapterId || !course) return;
    e.target.value = "";

    setUploading(true);
    try {
      const storagePath = `solutions-pdfs/${chapterId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("chapter-resources")
        .upload(storagePath, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: fileRecord, error: dbErr } = await supabase
        .from("uploaded_files")
        .insert({
          filename: file.name,
          mime_type: file.type,
          storage_path: storagePath,
          uploaded_by: user?.id || null,
          course_id: course.id,
          chapter_id: chapterId,
        })
        .select("id")
        .single();
      if (dbErr) throw dbErr;

      setActiveFileId(fileRecord.id);
      qc.invalidateQueries({ queryKey: ["uploaded-files", chapterId] });
      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const parseMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const file = uploadedFiles?.find((f) => f.id === fileId);
      if (!file || !course) throw new Error("File not found");

      setParsing(true);
      const { data, error } = await supabase.functions.invoke("parse-solutions-pdf", {
        body: {
          file_id: fileId,
          course_id: course.id,
          chapter_id: chapterId,
          storage_path: file.storage_path,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setParsing(false);
      qc.invalidateQueries({ queryKey: ["parsed-blocks", activeFileId] });
      toast.success(`Parsed ${data.blocks_found} solution blocks from ${data.total_pages} pages`);
    },
    onError: (err: Error) => {
      setParsing(false);
      toast.error(`Parse failed: ${err.message}`);
    },
  });

  const createSourcesMutation = useMutation({
    mutationFn: async (blockIds: string[]) => {
      if (!course || !chapterId) throw new Error("Missing context");
      const blocks = parsedBlocks?.filter((b) => blockIds.includes(b.id)) ?? [];
      if (!blocks.length) throw new Error("No blocks selected");

      // Check existing source codes to avoid duplicates
      const { data: existing } = await supabase
        .from("chapter_problems")
        .select("source_code")
        .eq("chapter_id", chapterId);
      const existingCodes = new Set((existing ?? []).map((e: any) => e.source_code?.toUpperCase()));

      const toCreate = blocks.filter(
        (b) => !existingCodes.has(b.source_code.toUpperCase().replace(/[–.]/g, "-"))
      );

      if (!toCreate.length) {
        toast.info("All selected blocks already have source problems");
        return { created: 0, skipped: blocks.length };
      }

      const inserts = toCreate.map((b) => ({
        course_id: course!.id,
        chapter_id: chapterId!,
        source_label: b.source_code,
        source_code: b.source_code,
        source_type: b.source_type,
        solution_text: b.cleaned_text,
        solution_text_confidence: b.confidence,
        solution_source: "pdf",
        solution_pdf_file_id: activeFileId,
        solution_pdf_page_start: b.page_start,
        solution_pdf_page_end: b.page_end,
        import_status: "needs_problem_screenshot",
        status: "raw",
        problem_text: "",
        problem_type: b.source_type === "BE" ? "exercise" : b.source_type === "P" ? "problem" : "exercise",
      }));

      const { error } = await supabase.from("chapter_problems").insert(inserts as any);
      if (error) throw error;

      // Update block statuses
      await supabase
        .from("parsed_solution_blocks")
        .update({ status: "created" })
        .in("id", toCreate.map((b) => b.id));

      return { created: toCreate.length, skipped: blocks.length - toCreate.length };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["parsed-blocks", activeFileId] });
      qc.invalidateQueries({ queryKey: ["chapter-problems"] });
      toast.success(`Created ${data?.created} source problems (${data?.skipped} skipped/duplicates)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (blockIds: string[]) => {
      const { error } = await supabase
        .from("parsed_solution_blocks")
        .update({ status: "archived" })
        .in("id", blockIds);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parsed-blocks", activeFileId] });
      toast.success("Archived");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (blockIds: string[]) => {
      const { error } = await supabase
        .from("parsed_solution_blocks")
        .delete()
        .in("id", blockIds);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parsed-blocks", activeFileId] });
      toast.success("Deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pendingBlocks = parsedBlocks?.filter((b) => b.status === "pending") ?? [];
  const lowConfidence = pendingBlocks.filter((b) => b.confidence < 0.6);

  if (!chapter || !course) {
    return (
      <SurviveSidebarLayout>
        <div className="text-foreground/80">Loading...</div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="mb-4">
        <Link
          to={`/workspace/${chapterId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace
        </Link>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground">{course.course_name}</p>
        <h1 className="text-xl font-bold text-foreground">
          Solutions PDF Upload — Ch {chapter.chapter_number}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a solutions manual PDF. The parser detects BE/E/P blocks and auto-creates source problems with solution text prefilled.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Upload PDF</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {uploading ? "Uploading…" : "Upload Solutions PDF"}
            </Button>
            {uploadedFiles && uploadedFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {uploadedFiles.map((f) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant={activeFileId === f.id ? "default" : "ghost"}
                    className="text-xs h-7"
                    onClick={() => setActiveFileId(f.id)}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {f.filename}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parse Section */}
      {activeFileId && (
        <Card className="mb-4">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">2. Parse & Review</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => parseMutation.mutate(activeFileId)}
                disabled={parsing}
              >
                {parsing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                {parsing ? "Parsing…" : "Parse PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {blocksLoading ? (
              <div className="text-xs text-muted-foreground py-4 text-center">Loading blocks…</div>
            ) : !parsedBlocks?.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No blocks parsed yet. Click "Parse PDF" to extract solution blocks.
              </p>
            ) : (
              <>
                {/* Summary + bulk actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {parsedBlocks.length} blocks found · {pendingBlocks.length} pending
                    </span>
                    {lowConfidence.length > 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {lowConfidence.length} low confidence
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() =>
                        archiveMutation.mutate(lowConfidence.map((b) => b.id))
                      }
                      disabled={!lowConfidence.length || archiveMutation.isPending}
                    >
                      <Archive className="h-3 w-3 mr-1" /> Archive Low Confidence
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      onClick={() =>
                        createSourcesMutation.mutate(pendingBlocks.map((b) => b.id))
                      }
                      disabled={!pendingBlocks.length || createSourcesMutation.isPending}
                    >
                      {createSourcesMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3 mr-1" />
                      )}
                      Create All Sources ({pendingBlocks.length})
                    </Button>
                  </div>
                </div>

                {/* Blocks table */}
                <div className="rounded-lg overflow-hidden border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-24">Code</TableHead>
                        <TableHead className="text-xs w-16">Type</TableHead>
                        <TableHead className="text-xs w-20">Confidence</TableHead>
                        <TableHead className="text-xs w-20">Pages</TableHead>
                        <TableHead className="text-xs">Preview</TableHead>
                        <TableHead className="text-xs w-16">Status</TableHead>
                        <TableHead className="text-xs w-28">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedBlocks.map((block) => (
                        <TableRow
                          key={block.id}
                          className={block.status === "archived" ? "opacity-40" : ""}
                        >
                          <TableCell className="text-xs font-mono font-medium">
                            {block.source_code}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {block.source_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                block.confidence >= 0.8
                                  ? "text-green-400 border-green-500/30"
                                  : block.confidence >= 0.6
                                  ? "text-amber-400 border-amber-500/30"
                                  : "text-red-400 border-red-500/30"
                              }`}
                            >
                              {Math.round(block.confidence * 100)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {block.page_start}
                            {block.page_end && block.page_end !== block.page_start
                              ? `–${block.page_end}`
                              : ""}
                          </TableCell>
                          <TableCell>
                            <button
                              className="text-xs text-left text-foreground/80 hover:text-foreground max-w-[300px] truncate block"
                              onClick={() =>
                                setExpandedBlock(
                                  expandedBlock === block.id ? null : block.id
                                )
                              }
                            >
                              {expandedBlock === block.id
                                ? block.cleaned_text
                                : block.cleaned_text.slice(0, 120) + (block.cleaned_text.length > 120 ? "…" : "")}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                block.status === "created"
                                  ? "text-green-400 border-green-500/30"
                                  : block.status === "archived"
                                  ? "text-muted-foreground"
                                  : "text-blue-400 border-blue-500/30"
                              }`}
                            >
                              {block.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {block.status === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => createSourcesMutation.mutate([block.id])}
                                  disabled={createSourcesMutation.isPending}
                                >
                                  <Check className="h-3 w-3 mr-0.5" /> Create
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] px-2 text-muted-foreground"
                                  onClick={() => archiveMutation.mutate([block.id])}
                                >
                                  <Archive className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] px-2 text-destructive"
                                  onClick={() => deleteMutation.mutate([block.id])}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Screenshot Capture Mode Link */}
      {chapterId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">3. Attach Problem Screenshots</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3">
              After creating sources from the solutions PDF, attach problem statement screenshots in fast-mode.
            </p>
            <Button size="sm" asChild>
              <Link to={`/screenshot-capture/${chapterId}`}>
                Enter Screenshot Capture Mode →
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </SurviveSidebarLayout>
  );
}
