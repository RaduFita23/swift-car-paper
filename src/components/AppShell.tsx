import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Car, FileText, LayoutDashboard, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  const items = [
    { to: "/dashboard", label: "Panou", icon: LayoutDashboard },
    { to: "/vehicles", label: "Mașini", icon: Car },
    { to: "/transactions", label: "Tranzacții", icon: FileText },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 border-r border-border bg-sidebar flex flex-col">
        <Link to="/" className="px-6 py-5 border-b border-border flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary grid place-items-center">
            <Car className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">AutoActe</span>
        </Link>
        <nav className="p-3 flex-1 space-y-1">
          {items.map((it) => {
            const active = loc.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <it.icon className="size-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button
            variant="ghost" size="sm" className="w-full justify-start"
            onClick={async () => { await signOut(); nav("/"); }}
          >
            <LogOut className="size-4 mr-2" /> Deconectare
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Se încarcă…</div>;
  if (!user) { window.location.href = "/auth"; return null; }
  return <AppShell>{children}</AppShell>;
}
