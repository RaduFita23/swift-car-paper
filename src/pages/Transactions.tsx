import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Schiță", docs_pending: "Acte în așteptare", ready: "Gata de semnat", signed: "Semnat",
};
const TYPE_LABEL: Record<string, string> = {
  pf_pf: "PF → PF", pf_pj: "PF → PJ", pj_pf: "PJ → PF", pj_pj: "PJ → PJ",
};

export default function Transactions() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<(Tables<"transactions"> & { vehicles: Pick<Tables<"vehicles">, "marca" | "model" | "nr_inmatriculare"> | null })[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions")
      .select("*, vehicles(marca, model, nr_inmatriculare)")
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .then(({ data }) => setTxs((data as any) ?? []));
  }, [user]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tranzacții</h1>
          <p className="text-muted-foreground mt-1">Vânzări și cumpărări de mașini.</p>
        </div>
        <Button asChild><Link to="/transactions/new"><Plus className="size-4 mr-2" /> Tranzacție nouă</Link></Button>
      </div>

      {txs.length === 0 ? (
        <Card className="mt-8 p-12 text-center">
          <FileText className="size-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Nicio tranzacție încă.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {txs.map((t) => (
            <Link key={t.id} to={`/transactions/${t.id}`}>
              <Card className="p-5 hover:shadow-md transition-shadow flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.vehicles?.marca} {t.vehicles?.model} <span className="text-muted-foreground text-sm">({t.vehicles?.nr_inmatriculare ?? "—"})</span></div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {TYPE_LABEL[t.type]} • {t.seller_id === user?.id ? "Vânzător" : "Cumpărător"} • {new Date(t.created_at).toLocaleDateString("ro-RO")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {t.price && <span className="font-medium">{Number(t.price).toLocaleString("ro-RO")} {t.currency}</span>}
                  <Badge variant={t.status === "signed" ? "default" : "secondary"}>{STATUS_LABEL[t.status]}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
