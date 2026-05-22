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
import { Loader2, Upload, Save } from "lucide-react";

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

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Adaugă mașină</h1>
      <p className="text-muted-foreground mt-1">Încarcă CIV-ul sau talonul pentru completare automată.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <OcrDrop label="CIV" busy={ocrBusy === "civ"} onFile={(f) => ocr(f, "civ")} />
        <OcrDrop label="Talon" busy={ocrBusy === "talon"} onFile={(f) => ocr(f, "talon")} />
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
        </div>
        <Button onClick={async () => {
          if (!v.marca || !v.model) { toast.error("Marca și modelul sunt obligatorii"); return; }
          setSaving(true);
          const { data, error } = await supabase.from("vehicles").insert({ ...v, owner_id: user!.id }).select().single();
          setSaving(false);
          if (error) toast.error(error.message);
          else { toast.success("Mașină adăugată"); nav(`/vehicles/${data.id}`); }
        }} disabled={saving}>
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
