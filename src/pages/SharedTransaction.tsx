import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useSharedTransaction, type SharedTransaction } from "@/modules/transactions/useSharedTransaction";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareTransactionDialog } from "@/components/ShareTransactionDialog";
import { DocumentUploader } from "@/components/DocumentUploader";
import { Car, Check, CheckCircle2, Clock, FileDown, FileText, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Role = "seller" | "buyer" | "guest";

export default function SharedTransaction() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { data: tx, loading, error, refresh } = useSharedTransaction(token);

  const [joining, setJoining] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [docs, setDocs] = useState<Tables<"documents">[]>([]);

  const role: Role = useMemo(() => {
    if (!user || !tx) return "guest";
    if (user.id === tx.seller_id) return "seller";
    if (user.id === tx.buyer_id) return "buyer";
    return "guest";
  }, [user, tx]);

  // Auto-join după autentificare (când venim cu ?join=1 după login)
  useEffect(() => {
    if (!user || !tx || !token) return;
    if (params.get("join") === "1" && !tx.buyer_id && tx.seller_id !== user.id) {
      void joinAsBuyer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tx?.id]);

  // Încarcă documentele asociate tranzacției (vizibile doar părților)
  useEffect(() => {
    if (!tx?.id || role === "guest") return;
    supabase
      .from("documents")
      .select("*")
      .eq("transaction_id", tx.id)
      .then(({ data }) => setDocs(data ?? []));
  }, [tx?.id, role, tx?.status, tx?.buyer_id]);

  // Auto-generare contract când ambele aprobări sunt înregistrate (doar seller declanșează,
  // ca să evităm dublu-INSERT din ambele browsere)
  useEffect(() => {
    if (!tx || role !== "seller") return;
    if (tx.seller_approved_at && tx.buyer_approved_at && !tx.has_contract && !generating) {
      void autoGenerateContract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx?.seller_approved_at, tx?.buyer_approved_at, tx?.has_contract, role]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <Centered>
        <h1 className="text-2xl font-semibold">Link invalid</h1>
        <p className="text-muted-foreground mt-2">
          {error ?? "Tranzacția nu există sau linkul a expirat."}
        </p>
        <Button asChild className="mt-6"><Link to="/">Înapoi</Link></Button>
      </Centered>
    );
  }

  // ───────────────────────── GUEST: prompt login / signup ─────────────────────
  if (role === "guest") {
    const carLabel = tx.vehicle ? `${tx.vehicle.marca ?? ""} ${tx.vehicle.model ?? ""}`.trim() : "autovehicul";
    const sellerLabel = tx.seller?.person_type === "juridica"
      ? tx.seller?.denumire_firma ?? "Vânzător"
      : [tx.seller?.nume, tx.seller?.prenume].filter(Boolean).join(" ") || "Vânzător";

    return (
      <Centered>
        <div className="size-12 rounded-md bg-primary grid place-items-center mb-4">
          <Car className="size-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Ai fost invitat la o tranzacție</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          <strong>{sellerLabel}</strong> te invită să cumperi <strong>{carLabel}</strong>.
          Pentru a continua, autentifică-te sau creează un cont — îți încarci buletinul și
          finalizați împreună contractul.
        </p>
        <div className="flex gap-2 mt-6">
          <Button asChild>
            <Link to={`/auth?mode=signup&redirect=${encodeURIComponent(`/t/${token}?join=1`)}`}>
              <LogIn className="size-4 mr-2" /> Creează cont și alătură-te
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/auth?redirect=${encodeURIComponent(`/t/${token}?join=1`)}`}>
              Am deja cont
            </Link>
          </Button>
        </div>
      </Centered>
    );
  }

  // ───────────────────── BUYER fără slot: trebuie să se alăture ───────────────
  const userIsLogged = !!user;
  const buyerSlotEmpty = !tx.buyer_id;
  const userIsSeller = role === "seller";

  if (userIsLogged && buyerSlotEmpty && !userIsSeller) {
    const carLabel = tx.vehicle ? `${tx.vehicle.marca ?? ""} ${tx.vehicle.model ?? ""}`.trim() : "—";
    const sellerLabel = tx.seller?.person_type === "juridica"
      ? tx.seller?.denumire_firma ?? "Vânzător"
      : [tx.seller?.nume, tx.seller?.prenume].filter(Boolean).join(" ") || "Vânzător";
    return (
      <Centered>
        <h1 className="text-2xl font-semibold tracking-tight">Te alături ca <strong>cumpărător</strong></h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          <strong>{sellerLabel}</strong> îți vinde <strong>{carLabel}</strong>
          {tx.price ? ` la prețul de ${Number(tx.price).toLocaleString("ro-RO")} ${tx.currency ?? ""}` : ""}.
        </p>
        <Button className="mt-6" disabled={joining} onClick={() => joinAsBuyer()}>
          {joining ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
          Confirm — sunt cumpărătorul
        </Button>
      </Centered>
    );
  }

  // ───────────────────────── WORKSPACE PARTAJAT ───────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary grid place-items-center">
              <Car className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">AutoActe</span>
          </Link>
          <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
            {humanStatus(tx.status)}
          </Badge>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <SectionHeader role={role} tx={tx} token={token!} />

        <VehicleCard vehicle={tx.vehicle} price={tx.price} currency={tx.currency} />

        <div className="grid md:grid-cols-2 gap-4">
          <PartyCard title="Vânzător" party={tx.seller} approvedAt={tx.seller_approved_at} highlight={role === "seller"} />
          <PartyCard title="Cumpărător" party={tx.buyer} approvedAt={tx.buyer_approved_at} highlight={role === "buyer"} pending={!tx.buyer_id} />
        </div>

        {/* Buyer-ul își încarcă buletinul aici */}
        {role === "buyer" && (
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Documentul tău</h3>
            <DocumentUploader
              userId={user!.id}
              type="buletin"
              label="Buletin (CI)"
              transactionId={tx.id}
              runOcr
              existing={(() => {
                const d = docs.find((x) => x.user_id === user!.id && x.type === "buletin");
                return d ? { id: d.id, storage_path: d.storage_path } : undefined;
              })()}
              onUploaded={async (ocr) => {
                if (ocr) {
                  // populăm profilul cumpărătorului din OCR (idempotent)
                  await supabase.from("profiles").update({
                    nume: ocr.nume ?? undefined,
                    prenume: ocr.prenume ?? undefined,
                    cnp: ocr.cnp ?? undefined,
                    serie_buletin: ocr.serie ?? undefined,
                    numar_buletin: ocr.numar ?? undefined,
                    adresa: ocr.adresa ?? undefined,
                    data_nasterii: ocr.data_nasterii ?? undefined,
                  }).eq("id", user!.id);
                }
                refresh();
              }}
            />
          </Card>
        )}

        {/* Aprobări duale */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Aprobă datele</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                După ce ambele părți confirmă, contractul PDF se generează automat și e disponibil pentru download.
              </p>
            </div>
            <div className="flex gap-3">
              <ApprovalPill label="Vânzător" at={tx.seller_approved_at} />
              <ApprovalPill label="Cumpărător" at={tx.buyer_approved_at} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <ApproveButton
              tx={tx}
              role={role}
              token={token!}
              docs={docs}
              userId={user!.id}
              busy={approving}
              setBusy={setApproving}
              onChange={refresh}
            />
            {role === "seller" && (
              <ShareTransactionDialog
                shareToken={token!}
                carLabel={tx.vehicle ? `${tx.vehicle.marca} ${tx.vehicle.model}` : undefined}
              />
            )}
          </div>
        </Card>

        {/* Contract finalizat */}
        {tx.has_contract && <ContractCard transactionId={tx.id} />}
        {generating && (
          <Card className="p-5 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Se generează contractul…
          </Card>
        )}
      </div>
    </div>
  );

  // ─── Acțiuni ────────────────────────────────────────────────────────────────
  async function joinAsBuyer() {
    if (!token) return;
    setJoining(true);
    const { error } = await supabase.rpc("join_transaction_as_buyer", { p_token: token });
    setJoining(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Te-ai alăturat tranzacției");
    refresh();
  }

  async function autoGenerateContract() {
    if (!tx) return;
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-contract", {
      body: {
        transactionId: tx.id, kind: tx.type,
        seller: { ...(tx.seller ?? {}), type: tx.seller?.person_type ?? "fizica" },
        buyer:  { ...(tx.buyer  ?? {}), type: tx.buyer?.person_type  ?? "fizica" },
        vehicle: tx.vehicle ?? {},
        price: Number(tx.price ?? 0),
        currency: tx.currency ?? "EUR",
        date: new Date().toLocaleDateString("ro-RO"),
      },
    });
    setGenerating(false);
    if (error) { toast.error(`Generare contract eșuată: ${error.message}`); return; }
    if ((data as any)?.url) toast.success("Contract generat!");
    refresh();
  }
}

// ─── Sub-componente ───────────────────────────────────────────────────────────

function SectionHeader({ role, tx, token }: { role: Role; tx: SharedTransaction; token: string }) {
  const buyerJoined = !!tx.buyer_id;
  if (role === "seller" && !buyerJoined) {
    return (
      <Card className="p-6 bg-accent/30">
        <div className="flex items-start gap-3">
          <Clock className="size-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Aștept cumpărătorul…</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Trimite linkul sau lasă-l să scaneze QR-ul. Pagina se actualizează automat când se conectează.
            </p>
          </div>
          <ShareTransactionDialog
            shareToken={token}
            carLabel={tx.vehicle ? `${tx.vehicle.marca} ${tx.vehicle.model}` : undefined}
          />
        </div>
      </Card>
    );
  }
  return null;
}

function VehicleCard({ vehicle, price, currency }: { vehicle: any; price: number | null; currency: string | null }) {
  if (!vehicle) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-semibold">{vehicle.marca} {vehicle.model} {vehicle.an ? `(${vehicle.an})` : ""}</h3>
          <p className="text-sm text-muted-foreground">
            VIN {vehicle.vin ?? "—"} • Nr. {vehicle.nr_inmatriculare ?? "—"} • {vehicle.capacitate_cilindrica ?? "—"} cmc
          </p>
        </div>
        {price ? (
          <div className="text-right">
            <div className="text-2xl font-semibold">{Number(price).toLocaleString("ro-RO")} {currency}</div>
            <div className="text-xs text-muted-foreground">preț de vânzare</div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PartyCard({
  title, party, approvedAt, highlight, pending,
}: {
  title: string; party: any; approvedAt: string | null; highlight?: boolean; pending?: boolean;
}) {
  return (
    <Card className={`p-5 ${highlight ? "border-primary" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title} {highlight && <span className="text-xs text-primary ml-1">(tu)</span>}</h3>
        {approvedAt
          ? <Badge variant="default" className="gap-1"><CheckCircle2 className="size-3" /> Aprobat</Badge>
          : <Badge variant="secondary">În așteptare</Badge>}
      </div>
      <div className="mt-3 text-sm space-y-1">
        {pending ? (
          <div className="text-muted-foreground italic">Se așteaptă conectarea…</div>
        ) : party?.person_type === "juridica" ? (
          <>
            <div className="font-medium">{party?.denumire_firma ?? "—"}</div>
            <div className="text-muted-foreground">CUI: {party?.cui ?? "—"}</div>
            <div className="text-muted-foreground">Reprezentant: {party?.reprezentant ?? "—"}</div>
            <div className="text-muted-foreground">{party?.adresa ?? "—"}</div>
          </>
        ) : (
          <>
            <div className="font-medium">{[party?.nume, party?.prenume].filter(Boolean).join(" ") || "—"}</div>
            <div className="text-muted-foreground">CNP: {party?.cnp ?? "—"}</div>
            <div className="text-muted-foreground">CI: {party?.serie_buletin ?? "—"} {party?.numar_buletin ?? ""}</div>
            <div className="text-muted-foreground">{party?.adresa ?? "—"}</div>
          </>
        )}
      </div>
    </Card>
  );
}

function ApprovalPill({ label, at }: { label: string; at: string | null }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
      at ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"
    }`}>
      {at ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
      {label}
    </div>
  );
}

function ApproveButton({
  tx, role, token, docs, userId, busy, setBusy, onChange,
}: {
  tx: SharedTransaction;
  role: Role;
  token: string;
  docs: Tables<"documents">[];
  userId: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onChange: () => void;
}) {
  const myApproval = role === "seller" ? tx.seller_approved_at : tx.buyer_approved_at;

  // Buyer trebuie să fi încărcat buletinul înainte să poată aproba
  const buyerHasBuletin = docs.some((d) => d.user_id === userId && d.type === "buletin");
  const canApprove = role === "seller" || (role === "buyer" && buyerHasBuletin);
  const blockReason = role === "buyer" && !buyerHasBuletin ? "Încarcă întâi buletinul" : null;

  const onClick = async () => {
    setBusy(true);
    const fn = myApproval ? "unapprove_transaction" : "approve_transaction";
    const { error } = await supabase.rpc(fn, { p_token: token });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(myApproval ? "Aprobare retrasă" : "Aprobat");
    onChange();
  };

  if (myApproval) {
    return (
      <Button variant="outline" onClick={onClick} disabled={busy}>
        {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle2 className="size-4 mr-2" />}
        Ai aprobat — anulează
      </Button>
    );
  }

  return (
    <Button onClick={onClick} disabled={busy || !canApprove} title={blockReason ?? undefined}>
      {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ShieldCheck className="size-4 mr-2" />}
      {blockReason ?? "Aprob datele"}
    </Button>
  );
}

function ContractCard({ transactionId }: { transactionId: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    const { data: contracts } = await supabase
      .from("contracts").select("*")
      .eq("transaction_id", transactionId)
      .order("generated_at", { ascending: false }).limit(1);
    const c = contracts?.[0];
    if (!c) { setBusy(false); toast.error("Contract negăsit"); return; }
    const { data } = await supabase.storage.from("contracts").createSignedUrl(c.pdf_path, 3600);
    setBusy(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <Card className="p-5 border-primary bg-accent/30">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-primary" />
          <div>
            <h3 className="font-semibold">Contract finalizat</h3>
            <p className="text-sm text-muted-foreground">Ambele părți au aprobat. Descarcă PDF-ul.</p>
          </div>
        </div>
        <Button onClick={download} disabled={busy}>
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FileDown className="size-4 mr-2" />}
          Descarcă contractul
        </Button>
      </div>
    </Card>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6 text-center">
      <div className="max-w-md">{children}</div>
    </div>
  );
}

function humanStatus(s: string): string {
  const map: Record<string, string> = {
    draft: "Ciornă",
    docs_pending: "Documente lipsă",
    awaiting_buyer: "Aștept cumpărătorul",
    awaiting_approvals: "Aștept aprobări",
    ready: "Gata",
    signed: "Semnat",
    completed: "Finalizat",
  };
  return map[s] ?? s;
}
