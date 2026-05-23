import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { DocumentUploader } from "@/components/DocumentUploader";
import { mapVehicleOcr } from "@/lib/ocr/vehicle";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function VehicleDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [v, setV] = useState<Tables<"vehicles"> | null>(null);
  const [docs, setDocs] = useState<Tables<"documents">[]>([]);

  const load = async () => {
    if (!id) return;
    const [{ data: ve }, { data: ds }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
      supabase.from("documents").select("*").eq("vehicle_id", id),
    ]);
    setV(ve); setDocs(ds ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!v) return <div className="p-8"><Loader2 className="animate-spin size-6" /></div>;

  const docTypes = [
    { type: "civ" as const, label: "CIV", ocr: true },
    { type: "talon" as const, label: "Talon", ocr: true },
    { type: "rca" as const, label: "Poliță RCA", ocr: true },
  ];

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{v.marca} {v.model}</h1>
          <p className="text-muted-foreground mt-1">{v.an ?? "—"} • {v.nr_inmatriculare ?? "fără număr"}</p>
        </div>
        <Button asChild><Link to="/transactions/new">Vinde această mașină</Link></Button>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Detalii tehnice</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Row label="VIN" value={v.vin} />
          <Row label="Serie CIV" value={v.serie_civ} />
          <Row label="Capacitate cilindrică" value={v.capacitate_cilindrica ? `${v.capacitate_cilindrica} cmc` : null} />
          <Row label="Culoare" value={v.culoare} />
          <Row label="Kilometraj" value={v.km ? `${v.km} km` : null} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Documente mașină</h3>
        <p className="text-sm text-muted-foreground mb-4">Salvăm actele și completăm automat datele tehnice de pe ele.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {docTypes.map(({ type, label, ocr }) => {
            const existing = docs.find((d) => d.type === type);
            return (
              <DocumentUploader
                key={type} userId={user!.id} type={type} label={label}
                vehicleId={v.id} runOcr={ocr}
                existing={existing ? { id: existing.id, storage_path: existing.storage_path } : undefined}
                onUploaded={async (ocrData) => {
                  // Auto-fill datele tehnice din CIV / talon înapoi în vehicul.
                  if ((type === "civ" || type === "talon") && ocrData) {
                    const mapped = mapVehicleOcr(ocrData);
                    const patch: Record<string, any> = {};
                    for (const [k, val] of Object.entries(mapped)) {
                      if (val === undefined || val === null || val === "") continue;
                      const current = (v as any)[k];
                      // Pentru ITP, dacă data citită e mai recentă decât cea existentă,
                      // o folosim (utilizatorul a încărcat probabil un talon mai nou).
                      if (k === "itp_expira_la" && current && typeof val === "string") {
                        if (new Date(val).getTime() > new Date(current).getTime()) patch[k] = val;
                      } else if (current === null || current === undefined || current === "") {
                        patch[k] = val;
                      }
                    }
                    if (Object.keys(patch).length > 0) {
                      const { error } = await supabase
                        .from("vehicles")
                        .update(patch as Tables<"vehicles">)
                        .eq("id", v.id);
                      if (error) toast.error(`Eroare update vehicul: ${error.message}`);
                      else toast.success(`Date completate din ${label}: ${Object.keys(patch).join(", ")}`);
                    }
                  }
                  load();
                }}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}
