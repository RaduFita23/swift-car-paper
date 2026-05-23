/**
 * Normalizează datele extrase de OCR de pe CIV / talon, înainte de a le pune în
 * formularul de vehicul sau de a le scrie în baza de date.
 *
 * Edge function-ul `ocr-document` aplică același tip de normalizare server-side,
 * dar repetăm și pe client ca să fim siguri că datele care vin din câmpuri
 * legacy (`ocr_data` din documente vechi) sunt curate.
 */

const COLOR_TRANSLATIONS: Record<string, string> = {
  white: "Alb",
  black: "Negru",
  red: "Roșu",
  blue: "Albastru",
  green: "Verde",
  yellow: "Galben",
  grey: "Gri",
  gray: "Gri",
  silver: "Argintiu",
  beige: "Bej",
  brown: "Maro",
  orange: "Portocaliu",
  purple: "Mov",
  pink: "Roz",
};

export function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (COLOR_TRANSLATIONS[lower]) return COLOR_TRANSLATIONS[lower];
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

/** Extrage primul număr întreg dintr-un string (ex: "1968 cm³" → 1968). */
export function normalizeIntFromString(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const m = value.match(/\d{1,5}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

/** Validează un an de fabricație (1900..an_curent+1). */
export function normalizeYear(value: unknown): number | null {
  const n = normalizeIntFromString(value);
  if (n === null) return null;
  const currentYear = new Date().getUTCFullYear();
  if (n < 1900 || n > currentYear + 1) return null;
  return n;
}

/** Curăță VIN-ul: uppercase, fără spații. */
export function normalizeVIN(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, "").toUpperCase();
  return v || null;
}

export interface VehicleOcr {
  marca?: string;
  model?: string;
  vin?: string;
  an_fabricatie?: number;
  capacitate_cilindrica?: number;
  culoare?: string;
  serie_civ?: string;
  nr_inmatriculare?: string;
  proprietar?: string;
  cnp_proprietar?: string;
  /** Data expirării ITP citită de pe talon (handwritten). Format YYYY-MM-DD. */
  itp_data_expirare?: string;
}

/** Normalizează un string dată în format ISO YYYY-MM-DD. Acceptă și DD.MM.YYYY etc. */
export function normalizeIsoDate(value: unknown): string | null {
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

/**
 * Mapează un răspuns OCR de tip CIV/talon la coloanele tabelei `vehicles`.
 * Returnează doar câmpurile populate (poate fi merged peste state-ul existent
 * fără a suprascrie cu undefined).
 */
export function mapVehicleOcr(d: Record<string, unknown> | null | undefined): {
  marca?: string;
  model?: string;
  vin?: string;
  an?: number;
  capacitate_cilindrica?: number;
  culoare?: string;
  serie_civ?: string;
  nr_inmatriculare?: string;
  /** Coloana DB `vehicles.itp_expira_la` (DATE). */
  itp_expira_la?: string;
} {
  if (!d) return {};
  const out: Record<string, any> = {};

  if (typeof d.marca === "string" && d.marca.trim()) out.marca = d.marca.trim().toUpperCase();
  if (typeof d.model === "string" && d.model.trim()) out.model = d.model.trim();

  const vin = normalizeVIN(d.vin);
  if (vin) out.vin = vin;

  const year = normalizeYear(d.an_fabricatie);
  if (year !== null) out.an = year;

  const cc = normalizeIntFromString(d.capacitate_cilindrica);
  if (cc !== null) out.capacitate_cilindrica = cc;

  const color = normalizeColor(d.culoare);
  if (color) out.culoare = color;

  if (typeof d.serie_civ === "string" && d.serie_civ.trim()) {
    out.serie_civ = d.serie_civ.trim().toUpperCase();
  }
  if (typeof d.nr_inmatriculare === "string" && d.nr_inmatriculare.trim()) {
    out.nr_inmatriculare = d.nr_inmatriculare.replace(/\s+/g, "").toUpperCase();
  }

  // Data ITP: poate veni fie ca `itp_data_expirare` (de pe talon), fie ca
  // `data_expirare` (de pe certificatul ITP separat). Coloana DB e `itp_expira_la`.
  const itpRaw = d.itp_data_expirare ?? d.data_expirare ?? null;
  const itpIso = normalizeIsoDate(itpRaw);
  if (itpIso) out.itp_expira_la = itpIso;

  return out;
}
