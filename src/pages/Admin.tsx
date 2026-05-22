import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";

export default function Admin() {
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = useState({ users: 0, vehicles: 0, transactions: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: u }, { count: v }, { count: t }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("vehicles").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("*", { count: "exact", head: true }),
        supabase.from("transactions").select("*, vehicles(marca, model)").order("created_at", { ascending: false }).limit(10),
      ]);
      setStats({ users: u ?? 0, vehicles: v ?? 0, transactions: t ?? 0 });
      setRecent(r ?? []);
    })();
  }, []);

  if (loading) return <div className="p-8">Se încarcă…</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        {Object.entries(stats).map(([k, v]) => (
          <Card key={k} className="p-5">
            <div className="text-sm text-muted-foreground capitalize">{k}</div>
            <div className="text-3xl font-semibold mt-2">{v}</div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Tranzacții recente</h3>
        <div className="space-y-2">
          {recent.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
              <div>{r.vehicles?.marca} {r.vehicles?.model}</div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{r.type}</span>
                <Badge variant="secondary">{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
