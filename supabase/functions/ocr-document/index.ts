// OCR pentru documente (buletin, CIV, talon etc.) folosind Lovable AI Gateway (Gemini vision)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DocType = "buletin" | "civ" | "talon" | "rca" | "cerere_inmatriculare" | "plata_certificat" | "contract_vc" | "itp";

const SCHEMAS: Record<DocType, { name: string; description: string; parameters: any }> = {
  buletin: {
    name: "extract_id_card",
    description: "Extrage datele de pe buletinul/CI românesc",
    parameters: {
      type: "object",
      properties: {
        nume: { type: "string" },
        prenume: { type: "string" },
        cnp: { type: "string" },
        serie: { type: "string" },
        numar: { type: "string" },
        adresa: { type: "string" },
        data_nasterii: { type: "string", description: "YYYY-MM-DD" },
        emis_de: { type: "string" },
        valabilitate: { type: "string" },
      },
      required: ["nume", "prenume", "cnp"],
      additionalProperties: false,
    },
  },
  civ: {
    name: "extract_civ",
    description: "Extrage datele din Cartea de Identitate a Vehiculului",
    parameters: {
      type: "object",
      properties: {
        serie_civ: { type: "string" },
        marca: { type: "string" },
        model: { type: "string" },
        vin: { type: "string" },
        an_fabricatie: { type: "number" },
        capacitate_cilindrica: { type: "number" },
        culoare: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  talon: {
    name: "extract_talon",
    description: "Extrage datele din talonul/certificatul de înmatriculare",
    parameters: {
      type: "object",
      properties: {
        nr_inmatriculare: { type: "string" },
        marca: { type: "string" },
        model: { type: "string" },
        vin: { type: "string" },
        proprietar: { type: "string" },
        cnp_proprietar: { type: "string" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { imageBase64, mimeType, type } = await req.json();
    if (!imageBase64 || !type) {
      return new Response(JSON.stringify({ error: "imageBase64 și type sunt obligatorii" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const schema = SCHEMAS[type as DocType] ?? SCHEMAS.contract_vc;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ești un asistent OCR specializat pe documente românești. Extrage datele cu acuratețe maximă. Răspunde doar prin tool call." },
          {
            role: "user",
            content: [
              { type: "text", text: `Extrage datele structurate din acest document de tip: ${type}` },
              { type: "image_url", image_url: { url: `data:${mimeType ?? "image/jpeg"};base64,${imageBase64}` } },
            ],
          },
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
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
    return new Response(JSON.stringify({ data: args }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ocr error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Eroare necunoscută" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
