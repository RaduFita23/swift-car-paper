import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, FileText, Plus, User } from "lucide-react";
import DemoAlertaWhatsApp from "@/components/DemoAlertaWhatsApp";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ vehicles: 0, transactions: 0, documents: 0 });
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { count: v }, { count: t }, { count: d }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("vehicles").select("*", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("transactions").select("*", { count: "exact", head: true }).or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`),
        supabase.from("documents").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setProfile(p);
      setStats({ vehicles: v ?? 0, transactions: t ?? 0, documents: d ?? 0 });
    })();
  }, [user]);

  const needsProfile = profile && !profile.nume && profile.person_type === "fizica";

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight">Bună{profile?.nume ? `, ${profile.nume}` : ""} 👋</h1>
      <p className="text-muted-foreground mt-1">Iată o privire de ansamblu asupra contului tău.</p>

      {needsProfile && (
        <Card className="mt-6 p-4 border-primary/30 bg-accent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="size-5 text-primary" />
            <div>
              <div className="font-medium">Completează-ți profilul</div>
              <div className="text-sm text-muted-foreground">Datele sunt necesare pentru a genera contracte.</div>
            </div>
          </div>
          <Button asChild><Link to="/profile">Completează</Link></Button>
        </Card>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mt-8">
        {[
          { icon: Car, label: "Mașini", value: stats.vehicles, to: "/vehicles" },
          { icon: FileText, label: "Tranzacții", value: stats.transactions, to: "/transactions" },
          { icon: FileText, label: "Documente", value: stats.documents, to: "/vehicles" },
        ].map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="p-5 hover:shadow-md transition-shadow">
              <s.icon className="size-5 text-primary" />
              <div className="text-3xl font-semibold mt-3">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex gap-3 flex-wrap">
        <Button asChild><Link to="/vehicles/new"><Plus className="size-4 mr-2" /> Adaugă mașină</Link></Button>
        <Button variant="outline" asChild><Link to="/transactions/new"><Plus className="size-4 mr-2" /> Inițiază tranzacție</Link></Button>
        <Button variant="outline" asChild><Link to="/profile"><User className="size-4 mr-2" /> Profil</Link></Button>
      </div>

      <div className="mt-8">
        <DemoAlertaWhatsApp />
      </div>
    </div>
  );
}
