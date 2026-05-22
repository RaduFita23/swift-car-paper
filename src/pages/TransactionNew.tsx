import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { resolveKind } from "@/modules/transactions/strategies/types";

export default function TransactionNew() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [vehicles, setVehicles] = useState<Tables<"vehicles">[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [buyerType, setBuyerType] = useState<"fizica" | "juridica">("fizica");
  const [buyer, setBuyer] = useState<any>({});
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("vehicles").select("*").eq("owner_id", user.id),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]).then(([v, p]) => {
      setVehicles(v.data ?? []);
      setMyProfile(p.data);
    });
  }, [user]);

  const sellerType: "fizica" | "juridica" = myProfile?.person_type ?? "fizica";

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Tranzacție nouă</h1>
      <p className="text-muted-foreground mt-1">Tu ești vânzătorul. Selectează mașina și introdu cumpărătorul.</p>

      <Card className="p-6 mt-6 space-y-5">
        <div className="space-y-2">
          <Label>Mașină</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger><SelectValue placeholder="Alege mașina vândută" /></SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.marca} {v.model} {v.nr_inmatriculare ? `• ${v.nr_inmatriculare}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Preț</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Monedă</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["EUR", "RON", "USD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tip cumpărător</Label>
          <RadioGroup value={buyerType} onValueChange={(v) => setBuyerType(v as any)} className="grid grid-cols-2 gap-2">
            {(["fizica", "juridica"] as const).map((t) => (
              <Label key={t} className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${buyerType === t ? "border-primary bg-accent" : "border-border"}`}>
                <RadioGroupItem value={t} className="sr-only" />
                <span className="capitalize text-sm">{t === "fizica" ? "Persoană fizică" : "Persoană juridică"}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        {buyerType === "fizica" ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Nume" v={buyer.nume} on={(x) => setBuyer({ ...buyer, nume: x })} />
            <F label="Prenume" v={buyer.prenume} on={(x) => setBuyer({ ...buyer, prenume: x })} />
            <F label="CNP" v={buyer.cnp} on={(x) => setBuyer({ ...buyer, cnp: x })} />
            <F label="Serie/Nr CI" v={buyer.serie_buletin} on={(x) => setBuyer({ ...buyer, serie_buletin: x })} />
            <F label="Telefon" v={buyer.telefon} on={(x) => setBuyer({ ...buyer, telefon: x })} />
            <F label="Email" v={buyer.email} on={(x) => setBuyer({ ...buyer, email: x })} />
            <div className="sm:col-span-2"><F label="Adresă" v={buyer.adresa} on={(x) => setBuyer({ ...buyer, adresa: x })} /></div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Denumire firmă" v={buyer.denumire_firma} on={(x) => setBuyer({ ...buyer, denumire_firma: x })} />
            <F label="CUI" v={buyer.cui} on={(x) => setBuyer({ ...buyer, cui: x })} />
            <F label="Nr. Reg. Com." v={buyer.nr_reg_com} on={(x) => setBuyer({ ...buyer, nr_reg_com: x })} />
            <F label="Reprezentant" v={buyer.reprezentant} on={(x) => setBuyer({ ...buyer, reprezentant: x })} />
            <div className="sm:col-span-2"><F label="Sediu" v={buyer.adresa} on={(x) => setBuyer({ ...buyer, adresa: x })} /></div>
          </div>
        )}

        <Button disabled={saving} onClick={async () => {
          if (!vehicleId) { toast.error("Selectează mașina"); return; }
          if (!price || +price <= 0) { toast.error("Preț invalid"); return; }
          setSaving(true);
          const kind = resolveKind(sellerType, buyerType);
          const { data, error } = await supabase.from("transactions").insert({
            seller_id: user!.id, vehicle_id: vehicleId, type: kind,
            buyer_snapshot: { type: buyerType, ...buyer },
            price: +price, currency, status: "docs_pending",
          }).select().single();
          setSaving(false);
          if (error) toast.error(error.message);
          else { toast.success("Tranzacție creată"); nav(`/transactions/${data.id}`); }
        }}>
          {saving && <Loader2 className="size-4 mr-2 animate-spin" />} Creează tranzacția
        </Button>
      </Card>
    </div>
  );
}

function F({ label, v, on }: { label: string; v: any; on: (s: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={v ?? ""} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
