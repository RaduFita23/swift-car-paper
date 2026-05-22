// Generează PDF contract de vânzare-cumpărare pe baza strategiei
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// duplicate strategy logic (lightweight) for edge runtime
type PType = "fizica" | "juridica";
interface ContractInput {
  transactionId: string;
  kind: "pf_pf" | "pf_pj" | "pj_pf" | "pj_pj";
  seller: any;
  buyer: any;
  vehicle: any;
  price: number;
  currency: string;
  date: string;
}

function block(p: any): string[] {
  if (p?.type === "juridica") {
    return [
      p.denumire_firma ?? "—",
      `CUI: ${p.cui ?? "—"} • Reg. Com.: ${p.nr_reg_com ?? "—"}`,
      `Reprezentant: ${p.reprezentant ?? "—"}`,
      `Sediu: ${p.adresa ?? "—"}`,
    ];
  }
  return [
    `${p?.nume ?? ""} ${p?.prenume ?? ""}`.trim() || "—",
    `CNP: ${p?.cnp ?? "—"}`,
    `BI/CI: ${p?.serie_buletin ?? "—"} ${p?.numar_buletin ?? ""}`,
    `Adresă: ${p?.adresa ?? "—"}`,
  ];
}

function clausesFor(kind: ContractInput["kind"]): string[] {
  const base = [
    "Vânzătorul declară că este unicul proprietar al autovehiculului și că acesta este liber de orice sarcini.",
    "Cumpărătorul a verificat starea autovehiculului și o acceptă ca atare.",
    "Plata prețului s-a efectuat integral la data semnării prezentului contract.",
    "Părțile se obligă să efectueze formalitățile de radiere și înmatriculare în termenele legale.",
    "Prezentul contract a fost redactat în 3 exemplare.",
  ];
  if (kind === "pj_pf" || kind === "pj_pj") base.push("Vânzătorul (PJ) va emite factură fiscală conform legislației.");
  if (kind === "pj_pj") base.push("Părțile aplică ștampila societății alături de semnătura reprezentantului legal.");
  return base;
}

// Replace Romanian diacritics not supported by Helvetica
function sanitize(s: string): string {
  return s
    .replace(/[ăâ]/g, "a").replace(/[ĂÂ]/g, "A")
    .replace(/î/g, "i").replace(/Î/g, "I")
    .replace(/ș/g, "s").replace(/Ș/g, "S")
    .replace(/ț/g, "t").replace(/Ț/g, "T");
}

async function buildPdf(c: ContractInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const margin = 50;
  const draw = (text: string, opts: { size?: number; b?: boolean; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    page.drawText(sanitize(text), { x: margin, y, size, font: opts.b ? bold : font, color: rgb(0.05, 0.05, 0.05) });
    y -= (opts.gap ?? size + 4);
  };

  draw("CONTRACT DE VANZARE-CUMPARARE AUTOVEHICUL", { size: 14, b: true, gap: 24 });
  draw(`Incheiat astazi ${c.date}`, { size: 9, gap: 18 });

  draw("I. PARTILE CONTRACTANTE", { size: 11, b: true, gap: 16 });
  draw("VANZATOR:", { b: true });
  block(c.seller).forEach((l) => draw(l));
  y -= 8;
  draw("CUMPARATOR:", { b: true });
  block(c.buyer).forEach((l) => draw(l));
  y -= 10;

  draw("II. OBIECTUL CONTRACTULUI", { size: 11, b: true, gap: 16 });
  const v = c.vehicle ?? {};
  [
    `${v.marca ?? ""} ${v.model ?? ""}${v.an ? ` (${v.an})` : ""}`.trim(),
    `Serie sasiu (VIN): ${v.vin ?? "—"}`,
    `Nr. inmatriculare: ${v.nr_inmatriculare ?? "—"}`,
    `Serie CIV: ${v.serie_civ ?? "—"}`,
    `Capacitate cilindrica: ${v.capacitate_cilindrica ?? "—"} cmc`,
    `Culoare: ${v.culoare ?? "—"}`,
  ].forEach((l) => draw(l));
  y -= 8;

  draw("III. PRETUL", { size: 11, b: true, gap: 16 });
  draw(`Pret: ${c.price.toLocaleString("ro-RO")} ${c.currency}`, { b: true });
  if (c.kind === "pj_pf" || c.kind === "pj_pj") {
    const tva = +(c.price * 0.19).toFixed(2);
    draw(`TVA 19%: ${tva.toLocaleString("ro-RO")} ${c.currency}`);
  }
  y -= 10;

  draw("IV. CLAUZE", { size: 11, b: true, gap: 16 });
  clausesFor(c.kind).forEach((cl, i) => {
    const wrapped = wrap(sanitize(cl), 95);
    draw(`${i + 1}. ${wrapped[0]}`);
    wrapped.slice(1).forEach((w) => draw(`   ${w}`));
  });

  y -= 30;
  draw("VANZATOR                                                   CUMPARATOR", { b: true });
  y -= 16;
  draw("_____________________                              _____________________");

  return await doc.save();
}

function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = (await req.json()) as ContractInput;
    if (!body.transactionId) throw new Error("transactionId missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const pdf = await buildPdf(body);
    const path = `${body.transactionId}/contract-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage.from("contracts").upload(path, pdf, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    const { error: insErr } = await supabase.from("contracts").insert({
      transaction_id: body.transactionId, pdf_path: path,
    });
    if (insErr) throw insErr;

    const { data: signed } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);

    return new Response(JSON.stringify({ path, url: signed?.signedUrl }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-contract error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Eroare" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
