import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Car, FileCheck, ScanLine, ShieldCheck } from "lucide-react";

const Landing = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-primary grid place-items-center">
            <Car className="size-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">AutoActe</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link to="/auth">Autentificare</Link></Button>
          <Button asChild><Link to="/auth?mode=signup">Cont nou</Link></Button>
        </div>
      </div>
    </header>

    <section className="container py-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs text-accent-foreground mb-6">
        <ScanLine className="size-3.5" /> OCR automat pe buletin, talon și CIV
      </div>
      <h1 className="text-5xl md:text-6xl font-semibold tracking-tight max-w-3xl mx-auto">
        Vinde și cumpără mașini, <span className="text-primary">cu actele în ordine.</span>
      </h1>
      <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
        Încarcă documentele, lasă-ne să le procesăm automat și generăm contractul de vânzare-cumpărare
        adaptat pentru tranzacții între persoane fizice și juridice.
      </p>
      <div className="flex items-center justify-center gap-3 mt-8">
        <Button size="lg" asChild><Link to="/auth?mode=signup">Începe gratuit</Link></Button>
        <Button size="lg" variant="outline" asChild><Link to="/auth">Am deja cont</Link></Button>
      </div>
    </section>

    <section className="container pb-24 grid md:grid-cols-3 gap-6">
      {[
        { icon: ScanLine, title: "OCR pe buletin", desc: "Crează contul automat — extragem CNP, nume, adresă din imaginea CI." },
        { icon: FileCheck, title: "Acte centralizate", desc: "Cererea de înmatriculare, RCA, CIV, talon, dovada plății — toate într-un loc." },
        { icon: ShieldCheck, title: "Contract generat", desc: "PDF gata de semnat, adaptat la tipul tranzacției (PF-PF, PF-PJ, PJ-PJ)." },
      ].map((f) => (
        <div key={f.title} className="rounded-lg border border-border bg-card p-6">
          <div className="size-10 rounded-md bg-accent grid place-items-center mb-4">
            <f.icon className="size-5 text-accent-foreground" />
          </div>
          <h3 className="font-semibold mb-1">{f.title}</h3>
          <p className="text-sm text-muted-foreground">{f.desc}</p>
        </div>
      ))}
    </section>

    <footer className="border-t border-border">
      <div className="container py-6 text-sm text-muted-foreground flex justify-between">
        <span>© {new Date().getFullYear()} AutoActe</span>
        <span>Made with Lovable</span>
      </div>
    </footer>
  </div>
);

export default Landing;
