import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setP(data ?? { person_type: "fizica" });
      setLoading(false);
    });
  }, [user]);

  if (loading || !p) return <div className="p-8"><Loader2 className="animate-spin size-6" /></div>;

  const set = (k: string, v: any) => setP({ ...p, [k]: v });

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Profil</h1>
      <p className="text-muted-foreground mt-1">Aceste date apar pe contractele generate.</p>

      <Card className="p-6 mt-6 space-y-5">
        <div className="space-y-2">
          <Label>Tip persoană</Label>
          <RadioGroup value={p.person_type} onValueChange={(v) => set("person_type", v)} className="grid grid-cols-2 gap-2">
            {(["fizica", "juridica"] as const).map((t) => (
              <Label key={t} className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${p.person_type === t ? "border-primary bg-accent" : "border-border"}`}>
                <RadioGroupItem value={t} className="sr-only" />
                <span className="capitalize text-sm">{t === "fizica" ? "Persoană fizică" : "Persoană juridică"}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        {p.person_type === "fizica" ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nume" value={p.nume} onChange={(v) => set("nume", v)} />
            <Field label="Prenume" value={p.prenume} onChange={(v) => set("prenume", v)} />
            <Field label="CNP" value={p.cnp} onChange={(v) => set("cnp", v)} />
            <Field label="Data nașterii" type="date" value={p.data_nasterii} onChange={(v) => set("data_nasterii", v)} />
            <Field label="Serie BI/CI" value={p.serie_buletin} onChange={(v) => set("serie_buletin", v)} />
            <Field label="Număr BI/CI" value={p.numar_buletin} onChange={(v) => set("numar_buletin", v)} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Denumire firmă" value={p.denumire_firma} onChange={(v) => set("denumire_firma", v)} />
            <Field label="CUI" value={p.cui} onChange={(v) => set("cui", v)} />
            <Field label="Nr. Reg. Comerțului" value={p.nr_reg_com} onChange={(v) => set("nr_reg_com", v)} />
            <Field label="Reprezentant legal" value={p.reprezentant} onChange={(v) => set("reprezentant", v)} />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Telefon" value={p.telefon} onChange={(v) => set("telefon", v)} />
          <Field label="Email" value={p.email} onChange={(v) => set("email", v)} />
        </div>
        <Field label="Adresă" value={p.adresa} onChange={(v) => set("adresa", v)} />

        <Button onClick={async () => {
          setSaving(true);
          const { error } = await supabase.from("profiles").update({
            person_type: p.person_type,
            nume: p.nume, prenume: p.prenume, cnp: p.cnp, data_nasterii: p.data_nasterii || null,
            serie_buletin: p.serie_buletin, numar_buletin: p.numar_buletin,
            denumire_firma: p.denumire_firma, cui: p.cui, nr_reg_com: p.nr_reg_com, reprezentant: p.reprezentant,
            telefon: p.telefon, email: p.email, adresa: p.adresa,
          }).eq("id", user!.id);
          setSaving(false);
          if (error) toast.error(error.message); else toast.success("Profil salvat");
        }} disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />} Salvează
        </Button>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
