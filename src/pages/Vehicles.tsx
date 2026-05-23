import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Plus, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function Vehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Tables<"vehicles">[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("vehicles").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setVehicles(data ?? []));
  }, [user]);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mașinile mele</h1>
          <p className="text-muted-foreground mt-1">Adaugă o mașină pentru a iniția o tranzacție.</p>
        </div>
        <Button asChild><Link to="/vehicles/new"><Plus className="size-4 mr-2" /> Adaugă mașină</Link></Button>
      </div>

      {vehicles.length === 0 ? (
        <Card className="mt-8 p-12 text-center">
          <Car className="size-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Nu ai nicio mașină înregistrată.</p>
          <Button asChild className="mt-4"><Link to="/vehicles/new">Adaugă prima mașină</Link></Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {vehicles.map((v) => {
            const itp = v.itp_expira_la ? new Date(v.itp_expira_la) : null;
            const days = itp ? Math.floor((itp.getTime() - Date.now()) / 86400000) : null;
            const expired = days !== null && days < 0;
            const soon = days !== null && days >= 0 && days <= 30;
            return (
              <Link key={v.id} to={`/vehicles/${v.id}`}>
                <Card className="p-5 hover:shadow-md transition-shadow">
                  <Car className="size-5 text-primary" />
                  <div className="mt-3 font-semibold">{v.marca} {v.model}</div>
                  <div className="text-sm text-muted-foreground">{v.an ?? "—"} • {v.nr_inmatriculare ?? "fără număr"}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">VIN: {v.vin ?? "—"}</div>
                  {itp && (
                    <div className={`mt-2 text-xs flex items-center gap-1 ${expired ? "text-destructive" : soon ? "text-orange-600" : "text-muted-foreground"}`}>
                      {(expired || soon) && <AlertTriangle className="size-3" />}
                      ITP: {itp.toLocaleDateString("ro-RO")}
                      {expired && " (expirat)"}
                      {soon && ` (în ${days} zile)`}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
