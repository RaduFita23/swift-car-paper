/**
 * Utilitare pentru CNP-ul românesc (Cod Numeric Personal).
 *
 * Structura CNP (13 cifre): S AA LL ZZ JJ NNN C
 *  - S  : sex + secol naștere
 *      1: masculin, 1900–1999
 *      2: feminin,  1900–1999
 *      3: masculin, 1800–1899
 *      4: feminin,  1800–1899
 *      5: masculin, 2000–2099
 *      6: feminin,  2000–2099
 *      7: bărbat rezident străin, 1900–2099
 *      8: femeie rezidentă străină, 1900–2099
 *      9: persoană fără cetățenie română (necunoscut)
 *  - AA : ultimele două cifre ale anului nașterii
 *  - LL : luna nașterii (01–12)
 *  - ZZ : ziua nașterii (01–31)
 *  - JJ : codul județului
 *  - NNN: număr de ordine
 *  - C  : cifra de control
 */

/** Coduri de control pentru cifra finală a CNP-ului. */
const CNP_CONTROL_KEY = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/** Curăță CNP-ul — elimină spații/caractere non-cifrice. */
export function sanitizeCNP(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
}

/** Verifică formatul (13 cifre) și cifra de control a CNP-ului. */
export function isValidCNP(value: string | null | undefined): boolean {
  const cnp = sanitizeCNP(value);
  if (cnp.length !== 13) return false;
  const sum = CNP_CONTROL_KEY.reduce(
    (acc, key, i) => acc + key * Number(cnp[i]),
    0,
  );
  const control = sum % 11;
  const expected = control === 10 ? 1 : control;
  return expected === Number(cnp[12]);
}

/**
 * Derivă data nașterii din CNP în format ISO `YYYY-MM-DD`.
 * Returnează `null` dacă CNP-ul e invalid sau data nu e validă.
 *
 * Aceasta e sursa de adevăr pentru data nașterii unei persoane cu CNP RO,
 * mai fiabilă decât citirea cifrelor mici de pe poza buletinului.
 */
export function cnpToBirthDate(value: string | null | undefined): string | null {
  const cnp = sanitizeCNP(value);
  if (cnp.length !== 13) return null;

  const s = Number(cnp[0]);
  const yy = Number(cnp.slice(1, 3));
  const mm = Number(cnp.slice(3, 5));
  const dd = Number(cnp.slice(5, 7));

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  let century: number;
  switch (s) {
    case 1:
    case 2:
      century = 1900;
      break;
    case 3:
    case 4:
      century = 1800;
      break;
    case 5:
    case 6:
      century = 2000;
      break;
    case 7:
    case 8:
    case 9: {
      // Rezidenți străini / necunoscut — nu există secol fix în CNP.
      // Heuristică: dacă AA depășește anul curent (2 cifre), presupunem 1900s, altfel 2000s.
      const currentYY = new Date().getUTCFullYear() % 100;
      century = yy > currentYY ? 1900 : 2000;
      break;
    }
    default:
      return null;
  }

  const year = century + yy;
  // Validăm că data e reală (ex: respinge 31 februarie).
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }

  const yStr = String(year).padStart(4, "0");
  const mStr = String(mm).padStart(2, "0");
  const dStr = String(dd).padStart(2, "0");
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Normalizează un text de tip dată într-un format ISO `YYYY-MM-DD`.
 * Acceptă: `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`, `DD-MM-YYYY`, `D.M.YYYY`.
 * Returnează `null` dacă nu poate parsa.
 */
export function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();

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
 * Aplică post-procesarea peste datele extrase de OCR de pe buletin.
 * - Curăță CNP-ul.
 * - Suprascrie `data_nasterii` cu valoarea derivată din CNP (sursa de adevăr).
 * - Folosește OCR ca fallback dacă CNP-ul lipsește/e invalid.
 * - Normalizează seria buletinului (uppercase) și `data_nasterii` la ISO.
 */
export function normalizeBuletinData(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...(raw ?? {}) };

  if (typeof data.cnp === "string") {
    data.cnp = sanitizeCNP(data.cnp);
  }

  if (typeof data.serie === "string") {
    data.serie = data.serie.trim().toUpperCase();
  }
  if (typeof data.numar === "string") {
    data.numar = data.numar.replace(/\D/g, "");
  }

  const fromCnp = cnpToBirthDate(typeof data.cnp === "string" ? data.cnp : null);
  const fromOcr =
    typeof data.data_nasterii === "string"
      ? normalizeIsoDate(data.data_nasterii)
      : null;

  data.data_nasterii = fromCnp ?? fromOcr ?? null;

  return data;
}
