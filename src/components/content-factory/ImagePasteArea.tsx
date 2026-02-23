import { useCallback, useRef } from "react";
import { X, ClipboardPaste, Image } from "lucide-react";

interface Props {
  label: string;
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}

export function ImagePasteArea({ label, files, onAdd, onRemove }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.items)
      .filter(i => i.type.startsWith("image/"))
      .map(i => i.getAsFile())
      .filter(Boolean) as File[];
    if (imgs.length) { e.preventDefault(); onAdd(imgs); }
  }, [onAdd]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const imgs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (imgs.length) onAdd(imgs);
  }, [onAdd]);

  return (
    <div
      ref={ref}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      tabIndex={0}
      className="min-h-[80px] rounded-md border-2 border-dashed border-border bg-muted/30 p-3 focus:border-primary focus:outline-none transition-colors cursor-pointer"
    >
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <ClipboardPaste className="h-3 w-3" /> {label}
      </p>
      {files.length === 0 ? (
        <div className="flex items-center justify-center py-3 text-muted-foreground/40">
          <Image className="h-8 w-8" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative group">
              <img src={URL.createObjectURL(f)} alt="" className="rounded border border-border w-full h-20 object-cover" />
              <button
                onClick={() => onRemove(i)}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
