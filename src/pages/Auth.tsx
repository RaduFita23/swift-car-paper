import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Car, Upload, Loader2 } from "lucide-react";
import { ocrDocument } from "@/lib/ocr/client";
import { useDropzone } from "react-dropzone";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Email invalid"),
  password: z.string().min(8, "Minim 8 caractere"),
  passwordConfirm: z.string(),
  telefon: z.string().trim().regex(/^[0-9+\s().-]{7,20}$/, "Număr de telefon invalid"),
}).refine((d) => d.password === d.passwordConfirm, {
  message: "Parolele nu coincid", path: ["passwordConfirm"],
});

export default function Auth() {
  const [params] = useSearchParams();
  const initial = params.get("mode") === "signup" ? "signup" : "login";
  return (
    <div className="min-h-screen bg-background grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-foreground text-background">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-primary grid place-items-center">
            <Car className="size-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">AutoActe</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Înregistrare cu un singur upload.</h2>
          <p className="mt-4 text-background/70 max-w-md">Încarcă buletinul și completăm automat datele contului tău.</p>
        </div>
        <div className="text-xs text-background/50">© AutoActe</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6">
          <Tabs defaultValue={initial}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Autentificare</TabsTrigger>
              <TabsTrigger value="signup">Cont nou</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm /></TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function LoginForm() {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <form className="space-y-4 mt-6" onSubmit={async (e) => {
      e.preventDefault(); setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) toast.error(error.message); else { toast.success("Bine ai revenit!"); nav("/dashboard"); }
    }}>
      <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="space-y-2"><Label>Parolă</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="size-4 mr-2 animate-spin" />}Autentificare</Button>
    </form>
  );
}

function SignupForm() {
  const nav = useNavigate();
  const [personType, setPersonType] = useState<"fizica" | "juridica">("fizica");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState(""); const [telefon, setTelefon] = useState("");
  const [loading, setLoading] = useState(false); const [ocrLoading, setOcrLoading] = useState(false);
  const [extracted, setExtracted] = useState<Record<string, any> | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);

  const onDrop = async (files: File[]) => {
    const f = files[0]; if (!f) return;
    setOcrFile(f); setOcrLoading(true);
    try {
      const data = await ocrDocument(f, "buletin");
      setExtracted(data);
      if (!email && data.email) setEmail(data.email);
      toast.success("Date extrase din buletin!");
    } catch (e: any) { toast.error(e.message ?? "OCR eșuat"); }
    finally { setOcrLoading(false); }
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "image/*": [], "application/pdf": [] }, maxFiles: 1 });

  return (
    <form className="space-y-4 mt-6" onSubmit={async (e) => {
      e.preventDefault();
      const parsed = signupSchema.safeParse({ email, password, passwordConfirm, telefon });
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      setLoading(true);
      const redirectUrl = `${window.location.origin}/dashboard`;
      const ocrWithPhone = { ...(extracted ?? {}), telefon };
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { person_type: personType, ocr: ocrWithPhone },
        },
      });
      if (error) { setLoading(false); toast.error(error.message); return; }
      // asigură telefonul în profil chiar dacă trigger-ul a rulat înainte
      if (data.user && data.session) {
        await supabase.from("profiles").update({ telefon }).eq("id", data.user.id);
      }
      // încarcă fișierul buletinului în storage (dacă există sesiune activă)
      if (data.user && data.session && ocrFile && extracted) {
        const path = `${data.user.id}/buletin-${Date.now()}-${ocrFile.name}`;
        await supabase.storage.from("documents").upload(path, ocrFile);
        await supabase.from("documents").insert({ user_id: data.user.id, type: "buletin", storage_path: path, ocr_data: extracted });
      }
      setLoading(false);
      toast.success("Cont creat!");
      nav("/dashboard");
    }}>
      <div className="space-y-2">
        <Label>Tip persoană</Label>
        <RadioGroup value={personType} onValueChange={(v) => setPersonType(v as any)} className="grid grid-cols-2 gap-2">
          {(["fizica", "juridica"] as const).map((t) => (
            <Label key={t} className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer ${personType === t ? "border-primary bg-accent" : "border-border"}`}>
              <RadioGroupItem value={t} className="sr-only" />
              <span className="capitalize text-sm">{t === "fizica" ? "Persoană fizică" : "Persoană juridică"}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {personType === "fizica" && (
        <div>
          <Label>Buletin (CI) — pentru OCR</Label>
          <div {...getRootProps()} className={`mt-2 border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-accent" : "border-border hover:border-primary"}`}>
            <input {...getInputProps()} />
            {ocrLoading ? <Loader2 className="size-6 mx-auto animate-spin text-primary" /> : <Upload className="size-6 mx-auto text-muted-foreground" />}
            <p className="text-sm text-muted-foreground mt-2">
              {ocrFile ? ocrFile.name : "Trage imaginea sau click pentru a alege"}
            </p>
          </div>
          {extracted && (
            <div className="mt-3 rounded-md bg-muted p-3 text-xs space-y-1">
              <div className="font-medium mb-1">Date extrase:</div>
              {Object.entries(extracted).map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="space-y-2"><Label>Telefon</Label><Input type="tel" required placeholder="07xx xxx xxx" value={telefon} onChange={(e) => setTelefon(e.target.value)} /></div>
      <div className="space-y-2"><Label>Parolă</Label><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <div className="space-y-2"><Label>Confirmă parola</Label><Input type="password" required minLength={8} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="size-4 mr-2 animate-spin" />}Creează cont</Button>
    </form>
  );
}
