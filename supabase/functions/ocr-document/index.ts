// OCR pentru documente (buletin, CIV, talon etc.) folosind Lovable AI Gateway (Gemini vision)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocType = "buletin" | "civ" | "talon" | "rca" | "cerere_inmatriculare" | "plata_certificat" | "contract_vc" | "itp";

const SCHEMAS: Record<DocType, { name: string; description: string; parameters: any }> = {
  buletin: {
    name: "extract_id_card",
    description: "Extrage datele de pe buletinul/Cartea de Identitate românească (CI). NU confunda data nașterii cu data eliberării sau valabilității.",
    parameters: {
      type: "object",
      properties: {
        nume: { type: "string", description: "Numele de familie (NUME)" },
        prenume: { type: "string", description: "Prenumele (PRENUME)" },
        cnp: { type: "string", description: "Cod Numeric Personal — exact 13 cifre, fără spații" },
        serie: { type: "string", description: "Seria CI: 2 litere mari (ex: RR, MX, KX, RT, RX, AS, BV)" },
        numar: { type: "string", description: "Numărul CI: 6 cifre" },
        adresa: { type: "string", description: "Adresa completă (domiciliul) așa cum apare pe buletin, inclusiv localitate și județ" },
        data_nasterii: { type: "string", description: "Data nașterii în format YYYY-MM-DD. ATENȚIE: e cea de pe rândul 'Data nașt.' sau marcată cu icoana 🎂, NU 'Data eliberării' și NU 'Valabilitate'" },
        emis_de: { type: "string", description: "Autoritatea emitentă (SPCLEP/SPCEEPS)" },
        valabilitate: { type: "string", description: "Data expirării CI în format YYYY-MM-DD" },
      },
      required: ["nume", "prenume", "cnp"],
      additionalProperties: false,
    },
  },
  civ: {
    name: "extract_civ",
    description: "Extrage datele din Cartea de Identitate a Vehiculului (CIV) românesc",
    parameters: {
      type: "object",
      properties: {
        serie_civ: { type: "string", description: "Seria CIV (ex: A0123456)" },
        marca: { type: "string", description: "Marca (D.1) — ex: DACIA, VOLKSWAGEN" },
        model: { type: "string", description: "Tip/model (D.2) — ex: Logan, Golf" },
        vin: { type: "string", description: "Serie șasiu / VIN (E) — exact 17 caractere alfanumerice" },
        an_fabricatie: { type: "number", description: "Anul fabricației (B sau separat) — 4 cifre, ex: 2018" },
        capacitate_cilindrica: { type: "number", description: "Capacitate cilindrică (P.1) în cm³ — număr întreg, ex: 1968" },
        culoare: { type: "string", description: "Culoarea (R) în limba română — ex: Alb, Negru, Roșu, Albastru, Gri" },
      },
      additionalProperties: false,
    },
  },
  talon: {
    name: "extract_talon",
    description: "Extrage datele din talonul/certificatul de înmatriculare românesc (format UE)",
    parameters: {
      type: "object",
      properties: {
        nr_inmatriculare: { type: "string", description: "Numărul de înmatriculare (A) — ex: B123ABC, CJ12XYZ" },
        marca: { type: "string", description: "Marca (D.1) — ex: DACIA, VOLKSWAGEN, BMW" },
        model: { type: "string", description: "Tip/model (D.2) sau (D.3) — ex: Logan, Golf, X5" },
        vin: { type: "string", description: "Serie șasiu / VIN (E) — exact 17 caractere alfanumerice" },
        an_fabricatie: { type: "number", description: "Anul fabricației (B = data primei înmatriculări — ia anul) sau câmp dedicat — 4 cifre, ex: 2018" },
        capacitate_cilindrica: { type: "number", description: "Capacitate cilindrică (P.1) în cm³ — număr întreg, ex: 1968. NU include unitatea." },
        culoare: { type: "string", description: "Culoarea (R) în limba română — ex: Alb, Negru, Roșu, Albastru, Gri" },
        proprietar: { type: "string", description: "Numele proprietarului (C.1.1)" },
        cnp_proprietar: { type: "string", description: "CNP proprietar (C.1.3) — 13 cifre" },
        itp_data_expirare: {
          type: "string",
          description:
            "Data următoarei inspecții tehnice (ITP) în format YYYY-MM-DD. " +
            "Apare SCRISĂ DE MÂNĂ pe spatele talonului, în tabelul cu coloana " +
            "'Data următoarei inspecții tehnice', alături de ștampila stației ITP. " +
            "Ia ULTIMA înregistrare din tabel (cea mai recentă valabilitate). " +
            "Lasă gol dacă nu se vede clar — NU ghici cifre de pe ștampilă.",
        },
      },
      additionalProperties: false,
    },
  },
  rca: {
    name: "extract_rca",
    description: "Extrage datele din polița RCA",
    parameters: {
      type: "object",
      properties: {
        serie_polita: { type: "string" },
        numar_polita: { type: "string" },
        asigurator: { type: "string" },
        valabilitate_inceput: { type: "string" },
        valabilitate_sfarsit: { type: "string" },
        nr_inmatriculare: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  cerere_inmatriculare: {
    name: "extract_generic",
    description: "Extrage textul principal",
    parameters: { type: "object", properties: { rezumat: { type: "string" } }, additionalProperties: false },
  },
  plata_certificat: {
    name: "extract_plata",
    description: "Extrage datele dovezii de plată",
    parameters: {
      type: "object",
      properties: { suma: { type: "number" }, data: { type: "string" }, beneficiar: { type: "string" } },
      additionalProperties: false,
    },
  },
  contract_vc: {
    name: "extract_generic",
    description: "Rezumă documentul",
    parameters: { type: "object", properties: { rezumat: { type: "string" } }, additionalProperties: false },
  },
  itp: {
    name: "extract_itp",
    description: "Extrage datele din certificatul ITP (Inspecția Tehnică Periodică)",
    parameters: {
      type: "object",
      properties: {
        nr_inmatriculare: { type: "string" },
        vin: { type: "string" },
        data_inspectiei: { type: "string", description: "YYYY-MM-DD" },
        data_expirare: { type: "string", description: "Data expirării ITP în format YYYY-MM-DD" },
        statie_itp: { type: "string" },
      },
      required: ["data_expirare"],
      additionalProperties: false,
    },
  },
};

const USER_PROMPTS: Partial<Record<DocType, string>> = {
  buletin: [
    "Extrage datele de pe acest buletin/Carte de Identitate românească (CI/BI).",
    "REGULI STRICTE:",
    "1. CNP-ul are EXACT 13 cifre. Citește-l caracter cu caracter, nu inventa cifre.",
    "2. Pentru `data_nasterii` ia DOAR data marcată ca 'Data nașt.' / 'Data nașterii' / 'Date of birth' (de obicei cu icoana 🎂 sau pe rândul cu sex/cetățenie).",
    "3. NU confunda `data_nasterii` cu 'Data eliberării' (issue date) sau cu 'Valabilitate' (expiry).",
    "4. Returnează toate datele în format `YYYY-MM-DD` (an-lună-zi).",
    "5. Seria CI = 2 litere majuscule (ex: RR, MX, KX, AS, BV); Numărul = 6 cifre.",
    "6. Dacă o dată nu se vede clar, lasă câmpul gol — NU ghici.",
  ].join("\n"),
  talon: [
    "Extrage datele de pe acest TALON / certificat de înmatriculare românesc (format UE).",
    "Câmpurile sunt etichetate cu coduri standardizate UE — folosește-le ca ancore:",
    "  • A   = Numărul de înmatriculare (ex: B123ABC, CJ12XYZ)",
    "  • B   = Data primei înmatriculări (an: extrage doar anul ca 4 cifre pentru `an_fabricatie`)",
    "  • C.1.1 = Numele proprietarului • C.1.3 = CNP proprietar",
    "  • D.1 = Marca (ex: DACIA, VOLKSWAGEN, BMW)",
    "  • D.2 sau D.3 = Tip/model (ex: Logan, Golf)",
    "  • E   = Serie șasiu (VIN) — EXACT 17 caractere alfanumerice (fără I, O, Q)",
    "  • P.1 = Capacitate cilindrică în cm³ — NUMĂR ÎNTREG, FĂRĂ unitate (ex: 1968, NU '1968 cm³')",
    "  • R   = Culoarea — REDĂ ÎN LIMBA ROMÂNĂ cu prima literă majusculă (ex: 'Alb', 'Negru', 'Roșu', 'Albastru', 'Gri')",
    "",
    "DATA ITP (`itp_data_expirare`) — câmp special, scris DE MÂNĂ pe VERSO:",
    "  ⚠ Dacă primești 2 imagini (față + verso), tabelul ITP e DOAR pe verso. ANALIZEAZĂ AMBELE imagini.",
    "  Pe spatele talonului există un tabel cu 3 coloane:",
    "    'Data inspecției' | 'Data următoarei inspecții tehnice' | 'Ștampila/Semnătura'",
    "  PAȘI:",
    "  1. Identifică tabelul cu inspecții ITP (de obicei pe verso, are mai multe rânduri ștampilate).",
    "  2. Scanează TOATE rândurile completate (cu ștampilă) din coloana 'Data următoarei inspecții tehnice'.",
    "  3. ALEGE cea mai RECENTĂ dată dintre toate (anul cel mai mare; la egalitate, luna/ziua cea mai mare).",
    "     Aceasta este de obicei rândul DE JOS al tabelului, dar ordinea fizică NU contează — contează data mai mare.",
    "  4. Returnează în format YYYY-MM-DD.",
    "  IMPORTANT:",
    "  • Câmpul e SCRIS DE MÂNĂ peste/lângă o ștampilă rotundă a stației ITP — ia-ți timp să citești cifră cu cifră.",
    "  • Confirmi rezultatul: data trebuie să fie în VIITOR (după anul curent) sau în trecutul recent;",
    "    dacă obții o dată mai veche de 2010 sau mai nouă de 2030, probabil e citire greșită — lasă GOL.",
    "  • Dacă tabelul nu e vizibil (poate ai doar fața talonului), lasă câmpul GOL.",
    "  • Dacă cifra e neclară din cauza ștampilei suprapuse, LASĂ GOL — e mai bine gol decât greșit.",
    "",
    "REGULI:",
    "1. Toate câmpurile P.1, R, B/F.1 sunt obligatorii pe talonul UE — caută-le atent.",
    "2. Pentru `capacitate_cilindrica` returnează doar numărul, fără 'cmc' / 'cm³' / 'cc'.",
    "3. Dacă culoarea apare în engleză sau alt format, tradu în română (ex: 'White' → 'Alb').",
    "4. Dacă un câmp lipsește real din document, lasă-l gol — NU inventa.",
  ].join("\n"),
  civ: [
    "Extrage datele din această Carte de Identitate a Vehiculului (CIV) românească.",
    "Folosește codurile UE când sunt prezente: D.1 (marca), D.2 (model), E (VIN), P.1 (capacitate cmc), R (culoare), B (an).",
    "REGULI:",
    "1. VIN-ul are EXACT 17 caractere alfanumerice (fără I, O, Q).",
    "2. `capacitate_cilindrica` = doar numărul în cm³, fără unitate (ex: 1968).",
    "3. `culoare` în limba română, prima literă majusculă (Alb, Negru, Roșu, Albastru, Gri, Verde, Galben, Argintiu, Bej).",
    "4. `an_fabricatie` = 4 cifre (ex: 2018).",
    "5. Dacă un câmp lipsește, lasă-l gol — NU inventa.",
  ].join("\n"),
};

// ─── Helpers CNP românesc ────────────────────────────────────────────────────
// Structură CNP: S(1) AA(2-3) LL(4-5) ZZ(6-7) JJ(8-9) NNN(10-12) C(13)
//   S: 1/2 → 1900s; 3/4 → 1800s; 5/6 → 2000s; 7/8/9 → străini

function sanitizeCNP(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "");
}

function cnpToBirthDate(value: unknown): string | null {
  const cnp = sanitizeCNP(value);
  if (cnp.length !== 13) return null;

  const s = Number(cnp[0]);
  const yy = Number(cnp.slice(1, 3));
  const mm = Number(cnp.slice(3, 5));
  const dd = Number(cnp.slice(5, 7));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  let century: number;
  switch (s) {
    case 1: case 2: century = 1900; break;
    case 3: case 4: century = 1800; break;
    case 5: case 6: century = 2000; break;
    case 7: case 8: case 9: {
      const currentYY = new Date().getUTCFullYear() % 100;
      century = yy > currentYY ? 1900 : 2000;
      break;
    }
    default: return null;
  }

  const year = century + yy;
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }

  const y = String(year).padStart(4, "0");
  const m = String(mm).padStart(2, "0");
  const d = String(dd).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// ─── Helpers vehicul (CIV / Talon) ───────────────────────────────────────────
// TODO: Standard OCR fails on Romanian handwritten ITP stamps. The current
// `google/gemini-2.5-flash` Vision model used here often misreads the ITP
// expiration date because it's HANDWRITTEN over a stamp in the back-side table
// "Data următoarei inspecții tehnice". For higher accuracy, replace this single
// general call with a SECOND, dedicated Vision LLM call (e.g. OpenAI GPT-4o or
// Claude 3.5 Sonnet Vision) prompted SPECIFICALLY to crop and read the
// handwritten date from that table column. Until then, we surface the field to
// the UI with a strong "verify-by-hand" warning.

const COLOR_TRANSLATIONS: Record<string, string> = {
  white: "Alb", black: "Negru", red: "Roșu", blue: "Albastru", green: "Verde",
  yellow: "Galben", grey: "Gri", gray: "Gri", silver: "Argintiu", beige: "Bej",
  brown: "Maro", orange: "Portocaliu", purple: "Mov", pink: "Roz",
};

function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (COLOR_TRANSLATIONS[lower]) return COLOR_TRANSLATIONS[lower];
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function normalizeIntFromString(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const m = value.match(/\d{1,5}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeYear(value: unknown): number | null {
  const n = normalizeIntFromString(value);
  if (n === null) return null;
  const currentYear = new Date().getUTCFullYear();
  if (n < 1900 || n > currentYear + 1) return null;
  return n;
}

function normalizeVIN(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, "").toUpperCase();
  if (v.length !== 17) return v || null; // returnăm chiar dacă != 17 (mai bine ceva decât nimic)
  return v;
}

function postProcessVehicle(args: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...args };

  const color = normalizeColor(out.culoare);
  if (color !== null) out.culoare = color; else delete out.culoare;

  const cc = normalizeIntFromString(out.capacitate_cilindrica);
  if (cc !== null) out.capacitate_cilindrica = cc; else delete out.capacitate_cilindrica;

  const year = normalizeYear(out.an_fabricatie);
  if (year !== null) out.an_fabricatie = year; else delete out.an_fabricatie;

  const vin = normalizeVIN(out.vin);
  if (vin !== null) out.vin = vin; else delete out.vin;

  if (typeof out.marca === "string") out.marca = out.marca.trim().toUpperCase();
  if (typeof out.model === "string") out.model = out.model.trim();
  if (typeof out.nr_inmatriculare === "string") {
    out.nr_inmatriculare = out.nr_inmatriculare.replace(/\s+/g, "").toUpperCase();
  }

  // Normalizează data ITP la format ISO (acceptă DD.MM.YYYY scris de mână)
  const itpIso = normalizeIsoDate(out.itp_data_expirare);
  if (itpIso) out.itp_data_expirare = itpIso; else delete out.itp_data_expirare;

  return out;
}

function postProcessBuletin(args: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...args };

  if (typeof out.cnp === "string") {
    out.cnp = sanitizeCNP(out.cnp);
  }
  if (typeof out.serie === "string") {
    out.serie = out.serie.trim().toUpperCase();
  }
  if (typeof out.numar === "string") {
    out.numar = out.numar.replace(/\D/g, "");
  }

  // CNP-ul e sursa de adevăr pentru data nașterii pe buletinul românesc.
  const fromCnp = cnpToBirthDate(out.cnp);
  const fromOcr = normalizeIsoDate(out.data_nasterii);
  out.data_nasterii = fromCnp ?? fromOcr ?? null;

  // Normalizează și valabilitatea dacă a venit ca DD.MM.YYYY.
  const validNorm = normalizeIsoDate(out.valabilitate);
  if (validNorm) out.valabilitate = validNorm;

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json();
    const { type, mimeType } = body;
    // Backwards compatibility: acceptă fie `imageBase64` (singur),
    // fie `imageBase64s` (array — pentru talon față+verso, sau alte multi-page docs).
    const imagesRaw: Array<{ base64: string; mimeType?: string }> = Array.isArray(body.imageBase64s)
      ? body.imageBase64s
      : body.imageBase64
        ? [{ base64: body.imageBase64, mimeType }]
        : [];

    if (imagesRaw.length === 0 || !type) {
      return new Response(JSON.stringify({ error: "imageBase64(s) și type sunt obligatorii" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const schema = SCHEMAS[type as DocType] ?? SCHEMAS.contract_vc;
    const userPrompt = USER_PROMPTS[type as DocType] ?? `Extrage datele structurate din acest document de tip: ${type}`;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Construim un array de bucăți de conținut: textul + toate imaginile.
    const userContent: any[] = [{ type: "text", text: userPrompt }];
    if (imagesRaw.length > 1) {
      userContent.push({
        type: "text",
        text: `Documentul este compus din ${imagesRaw.length} imagini (de ex. față + verso). Folosește informația din TOATE imaginile combinate ca să completezi câmpurile.`,
      });
    }
    for (const img of imagesRaw) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType ?? "image/jpeg"};base64,${img.base64}` },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ești un asistent OCR specializat pe documente românești. Extrage datele cu acuratețe maximă, citind caracter cu caracter. Răspunde doar prin tool call. Dacă un câmp nu se vede clar, lasă-l gol — NU ghici niciodată cifrele unei date sau ale unui CNP." },
          { role: "user", content: userContent },
        ],
        tools: [{ type: "function", function: schema }],
        tool_choice: { type: "function", function: { name: schema.name } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error", resp.status, txt);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Încearcă din nou într-un minut." }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Credit insuficient pentru AI. Adaugă fonduri în workspace." }), { status: 402, headers: { ...CORS, "Content-Type": "application/json" } });
      throw new Error(`AI gateway ${resp.status}`);
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    let args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};

    if (type === "buletin") {
      args = postProcessBuletin(args);
    } else if (type === "civ" || type === "talon") {
      args = postProcessVehicle(args);
    }

    return new Response(JSON.stringify({ data: args }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ocr error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Eroare necunoscută" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
