import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Navigate, Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, ShieldAlert, Users, Car, FileText, Coins, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

type Tx = {
  id: string;
  type: string;
  status: string;
  price: number | null;
  currency: string | null;
  created_at: string;
  seller_id: string;
  buyer_id: string | null;
  vehicles?: { marca: string; model: string; nr_inmatriculare: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Ciornă",
  pending_buyer: "Așteaptă cumpărător",
  signed: "Semnată",
  completed: "Finalizată",
  cancelled: "Anulată",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_buyer: "secondary",
  signed: "default",
  completed: "default",
  cancelled: "destructive",
};

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = useState({ users: 0, vehicles: 0, transactions: 0, completed: 0, pending: 0, sales: 0 });
  const [txs, setTxs] = useState<Tx[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ count: u }, { count: v }, { data: tAll }, { data: pAll }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("vehicles").select("*", { count: "exact", head: true }),
      supabase.from("transactions").select("*, vehicles(marca, model, nr_inmatriculare)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, nume, prenume, denumire_firma, person_type, created_at").order("created_at", { ascending: false }),
    ]);
    const list = (tAll ?? []) as Tx[];
    const completed = list.filter((x) => x.status === "completed").length;
    const pending = list.filter((x) => ["draft", "pending_buyer", "signed"].includes(x.status)).length;
    const sales = list.filter((x) => x.status === "completed").reduce((s, x) => s + Number(x.price || 0), 0);
    setStats({ users: u ?? 0, vehicles: v ?? 0, transactions: list.length, completed, pending, sales });
    setTxs(list);
    setProfiles(pAll ?? []);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!q) return true;
      const hay = `${t.vehicles?.marca ?? ""} ${t.vehicles?.model ?? ""} ${t.vehicles?.nr_inmatriculare ?? ""} ${t.id}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [txs, q, status]);

  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; sales: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      const key = d.toISOString().slice(0, 7);
      m.set(key, { month: d.toLocaleDateString("ro-RO", { month: "short" }), sales: 0, count: 0 });
    }
    txs.forEach((t) => {
      const key = t.created_at.slice(0, 7);
      const row = m.get(key);
      if (!row) return;
      row.count += 1;
      if (t.status === "completed") row.sales += Number(t.price || 0);
    });
    return Array.from(m.values());
  }, [txs]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    txs.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ status: STATUS_LABEL[k] ?? k, count: v }));
  }, [txs]);

  async function exportUserData(userId: string) {
    setBusy(true);
    try {
      const [{ data: profile }, { data: vehicles }, { data: tx }, { data: docs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("vehicles").select("*").eq("owner_id", userId),
        supabase.from("transactions").select("*").or(`seller_id.eq.${userId},buyer_id.eq.${userId}`),
        supabase.from("documents").select("*").eq("user_id", userId),
      ]);
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile, vehicles, transactions: tx, documents: docs }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `gdpr-export-${userId}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Date exportate (GDPR Art. 20)");
    } catch (e: any) {
      toast.error(e.message ?? "Eroare export");
    } finally { setBusy(false); }
  }

  async function anonymizeUser(userId: string) {
    if (!confirm("Anonimizezi datele personale ale acestui utilizator? Acțiunea nu poate fi anulată.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        nume: "ANONIMIZAT", prenume: "ANONIMIZAT", cnp: null, serie_buletin: null, numar_buletin: null,
        adresa: null, telefon: null, data_nasterii: null, email: null,
        denumire_firma: null, cui: null, nr_reg_com: null, reprezentant: null,
      }).eq("id", userId);
      if (error) throw error;
      toast.success("Date anonimizate (GDPR Art. 17)");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Eroare anonimizare");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="p-8">Se încarcă…</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const kpis = [
    { label: "Utilizatori", value: stats.users, icon: Users },
    { label: "Mașini", value: stats.vehicles, icon: Car },
    { label: "Tranzacții", value: stats.transactions, icon: FileText },
    { label: "Finalizate", value: stats.completed, icon: CheckCircle2 },
    { label: "În curs", value: stats.pending, icon: Clock },
    { label: "Vânzări (EUR)", value: stats.sales.toLocaleString("ro-RO"), icon: Coins },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Panou Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitorizare tranzacții, vânzări și conformitate GDPR.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <k.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold mt-2">{k.value}</div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Evidență vânzări</TabsTrigger>
          <TabsTrigger value="transactions">Tranzacții</TabsTrigger>
          <TabsTrigger value="gdpr">GDPR</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Vânzări lunare (EUR)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Distribuție status</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="status" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input placeholder="Caută după marcă, model, nr. înmatriculare, ID…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-md" />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate statusurile</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                <div className="col-span-3">Mașină</div>
                <div className="col-span-2">Tip</div>
                <div className="col-span-2">Preț</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-1 text-right">—</div>
              </div>
              <div className="divide-y divide-border">
                {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Nicio tranzacție</div>}
                {filtered.map((t) => (
                  <div key={t.id} className="grid grid-cols-12 px-4 py-3 text-sm items-center">
                    <div className="col-span-3">
                      <div className="font-medium">{t.vehicles?.marca} {t.vehicles?.model}</div>
                      <div className="text-xs text-muted-foreground">{t.vehicles?.nr_inmatriculare ?? "—"}</div>
                    </div>
                    <div className="col-span-2 text-muted-foreground">{t.type}</div>
                    <div className="col-span-2">{t.price ? `${Number(t.price).toLocaleString("ro-RO")} ${t.currency ?? ""}` : "—"}</div>
                    <div className="col-span-2"><Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>{STATUS_LABEL[t.status] ?? t.status}</Badge></div>
                    <div className="col-span-2 text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString("ro-RO")}</div>
                    <div className="col-span-1 text-right">
                      <Button asChild size="sm" variant="ghost"><Link to={`/transactions/${t.id}`}>Detalii</Link></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gdpr" className="space-y-4">
          <Card className="p-5 border-l-4 border-l-primary">
            <div className="flex gap-3">
              <ShieldAlert className="size-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Conformitate GDPR</p>
                <p className="text-muted-foreground mt-1">
                  Conform Regulamentului (UE) 2016/679, utilizatorii au dreptul la portabilitatea datelor (Art. 20) și la ștergere (Art. 17 — „dreptul de a fi uitat”).
                  Folosește acțiunile de mai jos pentru a răspunde solicitărilor. Anonimizarea este ireversibilă.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4">Utilizatori înregistrați</h3>
            <div className="border border-border rounded-md overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                <div className="col-span-4">Nume</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Tip</div>
                <div className="col-span-3 text-right">Acțiuni GDPR</div>
              </div>
              <div className="divide-y divide-border">
                {profiles.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 px-4 py-3 text-sm items-center">
                    <div className="col-span-4">
                      {p.person_type === "juridica" ? (p.denumire_firma ?? "—") : `${p.nume ?? ""} ${p.prenume ?? ""}`.trim() || "—"}
                    </div>
                    <div className="col-span-3 text-muted-foreground truncate">{p.email ?? "—"}</div>
                    <div className="col-span-2"><Badge variant="outline">{p.person_type}</Badge></div>
                    <div className="col-span-3 flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => exportUserData(p.id)}>
                        <Download className="size-3.5" /> Export
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => anonymizeUser(p.id)}>
                        Anonimizează
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
