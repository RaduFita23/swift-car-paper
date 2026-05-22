import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { ocrDocument } from "@/lib/ocr/client";
import { toast } from "sonner";
import { Loader2, Upload, FileCheck2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type DocType = Database["public"]["Enums"]["document_type"];

export function DocumentUploader({
  userId, type, label, vehicleId, transactionId, runOcr = false, existing, onUploaded,
}: {
  userId: string;
  type: DocType;
  label: string;
  vehicleId?: string;
  transactionId?: string;
  runOcr?: boolean;
  existing?: { id: string; storage_path: string };
  onUploaded?: (ocr?: Record<string, any>) => void;
}) {
  const [busy, setBusy] = useState(false);

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    try {
      let ocr: Record<string, any> | undefined;
      if (runOcr) {
        try { ocr = await ocrDocument(file, type); }
        catch (e: any) { toast.warning(`OCR a eșuat: ${e.message}. Documentul se salvează oricum.`); }
      }
      const path = `${userId}/${type}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("documents").insert({
        user_id: userId, type, storage_path: path, vehicle_id: vehicleId, transaction_id: transactionId, ocr_data: ocr,
      });
      if (insErr) throw insErr;
      toast.success(`${label} încărcat`);
      onUploaded?.(ocr);
    } catch (e: any) {
      toast.error(e.message ?? "Upload eșuat");
    } finally { setBusy(false); }
  }, [label, onUploaded, runOcr, transactionId, type, userId, vehicleId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => f[0] && upload(f[0]),
    accept: { "image/*": [], "application/pdf": [] },
    maxFiles: 1,
    disabled: busy || !!existing,
  });

  if (existing) {
    return (
      <div className="flex items-center justify-between border border-border rounded-md p-3 bg-accent">
        <div className="flex items-center gap-2 text-sm">
          <FileCheck2 className="size-4 text-primary" />
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground text-xs">încărcat</span>
        </div>
        <Button size="sm" variant="ghost" onClick={async () => {
          await supabase.storage.from("documents").remove([existing.storage_path]);
          await supabase.from("documents").delete().eq("id", existing.id);
          toast.success("Șters"); onUploaded?.();
        }}>
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-accent" : "border-border hover:border-primary"}`}>
      <input {...getInputProps()} />
      {busy ? <Loader2 className="size-5 mx-auto animate-spin text-primary" /> : <Upload className="size-5 mx-auto text-muted-foreground" />}
      <p className="text-sm font-medium mt-2">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{runOcr ? "Click sau drag — OCR automat" : "Click sau drag pentru upload"}</p>
    </div>
  );
}
