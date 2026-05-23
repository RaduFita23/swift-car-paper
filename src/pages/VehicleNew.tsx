import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ocrDocument } from "@/lib/ocr/client";
import { mapVehicleOcr } from "@/lib/ocr/vehicle";
import { useDropzone } from "react-dropzone";
import { AlertTriangle, Loader2, Upload, Save, FileCheck2, X } from "lucide-react";

export default function VehicleNew() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [v, setV] = useState<any>({});
  const [ocrBusy, setOcrBusy] = useState<"civ" | "talon" | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }));

  const ocr = async (file: File, type: "civ" | "talon") => {
    setOcrBusy(type);
    try {
      const d = await ocrDocument(file, type);
      setV((s: any) => ({ ...s, ...mapVehicleOcr(d) }));
      toast.success(`Date extrase din ${type}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setOcrBusy(null); }
  };

  const save = async () => {
    if (!v.marca || !v.model) { toast.error("Marca și modelul sunt obligatorii"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("vehicles").insert({ ...v, owner_id: user!.id }).select().single();
      if (error) throw error;
      toast.success("Mașină adăugată");
      nav(`/vehicles/${data.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Adaugă mașină</h1>
      <p className="text-muted-foreground mt-1">Încarcă CIV-ul și talonul pentru completare automată.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {/*
          CIV + Talon: previewable = thumbnail clickable după upload,
          care deschide un Dialog modal cu imaginea full-size pentru verificare.
        */}
        <OcrDrop label="CIV" busy={ocrBusy === "civ"} onFile={(f) => ocr(f, "civ")} previewable />
        <OcrDrop label="Talon" busy={ocrBusy === "talon"} onFile={(f) => ocr(f, "talon")} previewable />
      </div>

      <Card className="p-6 mt-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Marcă" value={v.marca} onChange={(x) => set("marca", x)} required />
          <F label="Model" value={v.model} onChange={(x) => set("model", x)} required />
          <F label="An fabricație" type="number" value={v.an} onChange={(x) => set("an", x ? +x : null)} />
          <F label="VIN" value={v.vin} onChange={(x) => set("vin", x)} />
          <F label="Nr. înmatriculare" value={v.nr_inmatriculare} onChange={(x) => set("nr_inmatriculare", x)} />
          <F label="Serie CIV" value={v.serie_civ} onChange={(x) => set("serie_civ", x)} />
          <F label="Capacitate cilindrică (cmc)" type="number" value={v.capacitate_cilindrica} onChange={(x) => set("capacitate_cilindrica", x ? +x : null)} />
          <F label="Culoare" value={v.culoare} onChange={(x) => set("culoare", x)} />
          <F
            label="Kilometraj"
            type="number"
            value={v.km}
            onChange={(x) => set("km", x ? +x : null)}
            helper="⚠️ Acest câmp trebuie completat de mână. Informația nu există în documentele încărcate (Talon/CIV)."
            helperVariant="error"
          />
          <F
            label="Valabilitate ITP (Data următoarei inspecții tehnice)"
            type="date"
            value={v.itp_expira_la}
            onChange={(x) => set("itp_expira_la", x || null)}
            helper="Verificați cu atenție! Această dată este scrisă de mână pe talon și poate fi citită greșit de sistem."
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />} Salvează
        </Button>
      </Card>
    </div>
  );
}

function F({
  label, value, onChange, type = "text", required, helper, helperVariant = "warning",
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  /** Text de ajutor afișat sub input. */
  helper?: string;
  /**
   * Variantă vizuală pentru helper:
   *  - "warning" (default): chihlimbar + iconiță triunghi (ex: data ITP scrisă de mână)
   *  - "error": roșu + text mai mare, fără iconiță (ex: câmpuri obligatorii care NU vin din OCR)
   */
  helperVariant?: "warning" | "error";
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      {helper && (
        helperVariant === "error" ? (
          <div className="text-sm text-red-600 dark:text-red-500">{helper}</div>
        ) : (
          <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span>{helper}</span>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Dropzone pentru OCR pe un singur document.
 * Cu `previewable`, păstrează fișierul în state local și afișează un thumbnail
 * clickable după upload — la click se deschide un Dialog modal cu imaginea
 * full-size pentru verificarea OCR-ului.
 */
function OcrDrop({
  label, busy, onFile, previewable,
}: {
  label: string;
  busy: boolean;
  onFile: (f: File) => void;
  previewable?: boolean;
}) {
  // State local pentru fișierul încărcat — folosit doar dacă `previewable` e true.
  // Datele OCR-ate ajung tot la parent prin `onFile()`, dar reținem fișierul
  // ca să-l putem afișa ca preview.
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  // URL local (object URL) pentru imagine — generat o singură dată per fișier
  // și revocat când fișierul se schimbă, ca să nu avem leak-uri de memorie.
  const previewUrl = useMemo(() => {
    if (!file || !previewable) return null;
    if (!file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file, previewable]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => {
      const first = f[0];
      if (!first) return;
      if (previewable) setFile(first);
      onFile(first);
    },
    accept: { "image/*": [], "application/pdf": [] },
    maxFiles: 1,
    disabled: busy,
  });

  // Stare 1: fișier încărcat + previewable → afișăm thumbnail + nume + acțiuni.
  if (previewable && file) {
    return (
      <>
        <div className="border-2 border-primary rounded-md p-3 bg-accent">
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="size-14 rounded overflow-hidden border border-border hover:ring-2 hover:ring-primary transition"
                aria-label={`Vezi imaginea ${label} la dimensiune mare`}
              >
                <img src={previewUrl} alt={`${label} thumbnail`} className="w-full h-full object-cover" />
              </button>
            ) : (
              // Fallback pentru PDF-uri (nu putem genera thumbnail dintr-un PDF).
              <div className="size-14 rounded bg-muted grid place-items-center shrink-0">
                <FileCheck2 className="size-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {previewUrl ? `${label} — click pe imagine pentru detalii` : `${label} încărcat`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="hover:bg-background rounded p-1 shrink-0"
              disabled={busy}
              aria-label="Înlocuiește fișierul"
              title="Înlocuiește"
            >
              <X className="size-4" />
            </button>
          </div>
          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Loader2 className="size-3 animate-spin text-primary" /> Se procesează OCR…
            </div>
          )}
        </div>

        {/* Modal de verificare imagine — folosește shadcn/ui Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{label} — verificare imagine</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="rounded-md overflow-hidden bg-muted max-h-[70vh]">
                <img src={previewUrl} alt={label} className="w-full h-auto object-contain" />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Închide</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Stare 2: niciun fișier (sau previewable=false) → drop zone clasic.
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition ${isDragActive ? "border-primary bg-accent" : "border-border hover:border-primary"}`}>
      <input {...getInputProps()} />
      {busy ? <Loader2 className="size-5 mx-auto animate-spin text-primary" /> : <Upload className="size-5 mx-auto text-muted-foreground" />}
      <p className="text-sm font-medium mt-2">Scan {label}</p>
      <p className="text-xs text-muted-foreground">OCR automat</p>
    </div>
  );
}
