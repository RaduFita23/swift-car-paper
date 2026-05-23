import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ocrDocument } from "@/lib/ocr/client";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload, Save, FileCheck2, X } from "lucide-react";

export default function VehicleNew() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [v, setV] = useState<any>({});
  const [ocrBusy, setOcrBusy] = useState<"civ" | "talon" | "itp" | null>(null);
  const [itpFile, setItpFile] = useState<File | null>(null);
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

  const handleItp = async (file: File) => {
    setOcrBusy("itp");
    setItpFile(file);
    try {
      const d = await ocrDocument(file, "itp");
      if (d.data_expirare) {
        set("itp_expira_la", d.data_expirare);
        toast.success(`ITP expiră la ${d.data_expirare}`);
      } else {
        toast.warning("Nu am putut extrage data expirării. Introduc-o manual.");
      }
    } catch (e: any) {
      toast.warning(`OCR ITP a eșuat: ${e.message}. Introduc-o manual.`);
    } finally { setOcrBusy(null); }
  };

  const save = async () => {
    if (!v.marca || !v.model) { toast.error("Marca și modelul sunt obligatorii"); return; }
    if (!itpFile) { toast.error("Documentul ITP este obligatoriu"); return; }
    if (!v.itp_expira_la) { toast.error("Data expirării ITP este obligatorie"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("vehicles").insert({ ...v, owner_id: user!.id }).select().single();
      if (error) throw error;
      const path = `${user!.id}/itp-${Date.now()}-${itpFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, itpFile);
      if (upErr) throw upErr;
      await supabase.from("documents").insert({
        user_id: user!.id, type: "itp", storage_path: path, vehicle_id: data.id,
        ocr_data: { data_expirare: v.itp_expira_la },
      });
      toast.success("Mașină adăugată");
      nav(`/vehicles/${data.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Adaugă mașină</h1>
      <p className="text-muted-foreground mt-1">Încarcă CIV-ul, talonul și ITP-ul pentru completare automată.</p>

      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        <OcrDrop label="CIV" busy={ocrBusy === "civ"} onFile={(f) => ocr(f, "civ")} />
        <OcrDrop label="Talon" busy={ocrBusy === "talon"} onFile={(f) => ocr(f, "talon")} />
        <ItpDrop file={itpFile} busy={ocrBusy === "itp"} onFile={handleItp} onClear={() => { setItpFile(null); set("itp_expira_la", null); }} />
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
          <F label="Kilometraj" type="number" value={v.km} onChange={(x) => set("km", x ? +x : null)} />
          <F label="ITP expiră la" type="date" value={v.itp_expira_la} onChange={(x) => set("itp_expira_la", x || null)} required />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />} Salvează
        </Button>
      </Card>
    </div>
  );
}

function mapVehicleOcr(d: any) {
  const out: any = {};
  if (d.marca) out.marca = d.marca;
  if (d.model) out.model = d.model;
  if (d.vin) out.vin = d.vin;
  if (d.an_fabricatie) out.an = d.an_fabricatie;
  if (d.capacitate_cilindrica) out.capacitate_cilindrica = d.capacitate_cilindrica;
  if (d.culoare) out.culoare = d.culoare;
  if (d.serie_civ) out.serie_civ = d.serie_civ;
  if (d.nr_inmatriculare) out.nr_inmatriculare = d.nr_inmatriculare;
  return out;
}

function F({ label, value, onChange, type = "text", required }: { label: string; value: any; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function OcrDrop({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => f[0] && onFile(f[0]),
    accept: { "image/*": [], "application/pdf": [] }, maxFiles: 1, disabled: busy,
  });
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition ${isDragActive ? "border-primary bg-accent" : "border-border hover:border-primary"}`}>
      <input {...getInputProps()} />
      {busy ? <Loader2 className="size-5 mx-auto animate-spin text-primary" /> : <Upload className="size-5 mx-auto text-muted-foreground" />}
      <p className="text-sm font-medium mt-2">Scan {label}</p>
      <p className="text-xs text-muted-foreground">OCR automat</p>
    </div>
  );
}

function ItpDrop({ file, busy, onFile, onClear }: { file: File | null; busy: boolean; onFile: (f: File) => void; onClear: () => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (f) => f[0] && onFile(f[0]),
    accept: { "application/pdf": [], "image/*": [] }, maxFiles: 1, disabled: busy || !!file,
  });
  if (file) {
    return (
      <div className="border-2 border-primary rounded-md p-4 bg-accent flex flex-col items-center justify-center text-center relative">
        <FileCheck2 className="size-5 text-primary" />
        <p className="text-sm font-medium mt-2 truncate max-w-full">{file.name}</p>
        <p className="text-xs text-muted-foreground">ITP încărcat</p>
        <button type="button" onClick={onClear} className="absolute top-1 right-1 p-1 hover:bg-background rounded"><X className="size-3" /></button>
      </div>
    );
  }
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition ${isDragActive ? "border-primary bg-accent" : "border-border hover:border-primary"}`}>
      <input {...getInputProps()} />
      {busy ? <Loader2 className="size-5 mx-auto animate-spin text-primary" /> : <Upload className="size-5 mx-auto text-muted-foreground" />}
      <p className="text-sm font-medium mt-2">ITP (PDF) *</p>
      <p className="text-xs text-muted-foreground">OCR extrage expirarea</p>
    </div>
  );
}
