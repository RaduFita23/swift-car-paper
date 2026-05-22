import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, FileDown, FileText } from "lucide-react";
import { DocumentUploader } from "@/components/DocumentUploader";
import { getStrategyByKind } from "@/modules/transactions/strategies/registry";
import { profileToParty } from "@/modules/transactions/strategies/types";
import type { Tables } from "@/integrations/supabase/types";

const DOC_LABELS: Record<string, string> = {
  cerere_inmatriculare: "Cerere de înmatriculare",
  contract_vc: "Contract VC (anterior)",
  rca: "Poliță RCA",
  plata_certificat: "Dovada plății certificatului",
  civ: "CIV",
  talon: "Talon",
  buletin: "Buletin",
};

export default function TransactionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tx, setTx] = useState<any>(null);
  const [vehicle, setVehicle] = useState<Tables<"vehicles"> | null>(null);
  const [docs, setDocs] = useState<Tables<"documents">[]>([]);
  const [seller, setSeller] = useState<any>(null);
  const [contracts, setContracts] = useState<Tables<"contracts">[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: t } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
    if (!t) return;
    setTx(t);
    const [v, d, s, c] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", t.vehicle_id).maybeSingle(),
      supabase.from("documents").select("*").eq("transaction_id", id),
      supabase.from("profiles").select("*").eq("id", t.seller_id).maybeSingle(),
      supabase.from("contracts").select("*").eq("transaction_id", id).order("generated_at", { ascending: false }),
    ]);
    setVehicle(v.data); setDocs(d.data ?? []); setSeller(s.data); setContracts(c.data ?? []);
  };

  useEffect(() => { load(); }, [id]);

  if (!tx || !vehicle) return <div className="p-8"><Loader2 className="animate-spin size-6" /></div>;

  const strategy = getStrategyByKind(tx.type);
  const requiredDocs = strategy.requiredDocuments().filter((d) => d !== "buletin");
  const uploadedTypes = new Set(docs.map((d) => d.type));
  const sellerParty = profileToParty(seller);
  const buyerParty = tx.buyer_snapshot;

  const ctx = {
    seller: sellerParty,
    buyer: buyerParty,
    vehicle: {
      marca: vehicle.marca, model: vehicle.model, an: vehicle.an, vin: vehicle.vin,
      nr_inmatriculare: vehicle.nr_inmatriculare, serie_civ: vehicle.serie_civ,
      capacitate_cilindrica: vehicle.capacitate_cilindrica, culoare: vehicle.culoare,
    },
    price: Number(tx.price), currency: tx.currency, date: new Date().toLocaleDateString("ro-RO"),
    uploadedDocs: [...uploadedTypes] as any,
  };
  const validation = strategy.validate(ctx);

  const generate = async () => {
    if (!validation.ok) { toast.error("Mai sunt documente sau date lipsă"); return; }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-contract", {
      body: {
        transactionId: tx.id, kind: tx.type,
        seller: sellerParty, buyer: buyerParty, vehicle: ctx.vehicle,
        price: ctx.price, currency: ctx.currency, date: ctx.date,
      },
    });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contract generat");
    if ((data as any)?.url) window.open((data as any).url, "_blank");
    await supabase.from("transactions").update({ status: "ready" }).eq("id", tx.id);
    load();
  };

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{vehicle.marca} {vehicle.model}</h1>
          <p className="text-muted-foreground mt-1">{strategy.label}</p>
        </div>
        <Badge variant={tx.status === "signed" ? "default" : "secondary"}>{tx.status}</Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Vânzător</h3>
          <PartyView p={sellerParty} />
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Cumpărător</h3>
          <PartyView p={buyerParty} />
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Documente necesare</h3>
        <p className="text-sm text-muted-foreground mb-4">Încarcă toate actele pentru a putea genera contractul.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {requiredDocs.map((type) => {
            const existing = docs.find((d) => d.type === type);
            return (
              <DocumentUploader
                key={type}
                userId={user!.id}
                type={type}
                label={DOC_LABELS[type]}
                transactionId={tx.id}
                vehicleId={tx.vehicle_id}
                runOcr={type === "civ" || type === "talon" || type === "rca"}
                existing={existing ? { id: existing.id, storage_path: existing.storage_path } : undefined}
                onUploaded={load}
              />
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Contract de vânzare-cumpărare</h3>
            <p className="text-sm text-muted-foreground">Generare automată conform tipului tranzacției.</p>
          </div>
          <Button onClick={generate} disabled={generating || !validation.ok}>
            {generating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FileText className="size-4 mr-2" />}
            Generează PDF
          </Button>
        </div>
        {!validation.ok && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            {validation.missing.length > 0 && <div>Documente lipsă: <strong>{validation.missing.map((m) => DOC_LABELS[m]).join(", ")}</strong></div>}
            {validation.errors.map((er, i) => <div key={i} className="text-destructive">{er}</div>)}
          </div>
        )}
        {contracts.length > 0 && (
          <div className="mt-4 space-y-2">
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-border rounded-md p-3">
                <div className="text-sm">Contract • {new Date(c.generated_at).toLocaleString("ro-RO")}</div>
                <Button size="sm" variant="outline" onClick={async () => {
                  const { data } = await supabase.storage.from("contracts").createSignedUrl(c.pdf_path, 3600);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                }}>
                  <FileDown className="size-4 mr-2" /> Descarcă
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PartyView({ p }: { p: any }) {
  if (!p) return <div className="text-sm text-muted-foreground">—</div>;
  if (p.type === "juridica") {
    return (
      <div className="text-sm space-y-1">
        <div className="font-medium">{p.denumire_firma ?? "—"}</div>
        <div className="text-muted-foreground">CUI: {p.cui ?? "—"}</div>
        <div className="text-muted-foreground">Reprezentant: {p.reprezentant ?? "—"}</div>
        <div className="text-muted-foreground">{p.adresa ?? "—"}</div>
      </div>
    );
  }
  return (
    <div className="text-sm space-y-1">
      <div className="font-medium">{[p.nume, p.prenume].filter(Boolean).join(" ") || "—"}</div>
      <div className="text-muted-foreground">CNP: {p.cnp ?? "—"}</div>
      <div className="text-muted-foreground">CI: {p.serie_buletin ?? "—"} {p.numar_buletin ?? ""}</div>
      <div className="text-muted-foreground">{p.adresa ?? "—"}</div>
    </div>
  );
}
