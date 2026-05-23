import { describe, it, expect } from "vitest";
import {
  cnpToBirthDate,
  isValidCNP,
  normalizeBuletinData,
  normalizeIsoDate,
  sanitizeCNP,
} from "@/lib/ocr/cnp";

describe("sanitizeCNP", () => {
  it("elimină spațiile și non-cifrele", () => {
    expect(sanitizeCNP("1 850 315 12 34 56")).toBe("1850315123456");
    expect(sanitizeCNP("CNP: 1.850.315.123.456")).toBe("1850315123456");
  });
  it("acceptă null/undefined", () => {
    expect(sanitizeCNP(null)).toBe("");
    expect(sanitizeCNP(undefined)).toBe("");
  });
});

describe("cnpToBirthDate", () => {
  it("CNP masculin 1900s → data corectă", () => {
    // 1850315... → S=1, AA=85, LL=03, ZZ=15 → 1985-03-15
    expect(cnpToBirthDate("1850315123456")).toBe("1985-03-15");
  });

  it("CNP feminin 1900s → data corectă", () => {
    // 2900101... → S=2, AA=90, LL=01, ZZ=01 → 1990-01-01
    expect(cnpToBirthDate("2900101123456")).toBe("1990-01-01");
  });

  it("CNP masculin 2000s → data corectă", () => {
    // 5050620... → S=5, AA=05, LL=06, ZZ=20 → 2005-06-20
    expect(cnpToBirthDate("5050620123456")).toBe("2005-06-20");
  });

  it("CNP feminin 2000s → data corectă", () => {
    // 6151231... → S=6, AA=15, LL=12, ZZ=31 → 2015-12-31
    expect(cnpToBirthDate("6151231123456")).toBe("2015-12-31");
  });

  it("CNP masculin 1800s → data corectă", () => {
    // 3950724... → S=3, AA=95, LL=07, ZZ=24 → 1895-07-24
    expect(cnpToBirthDate("3950724123456")).toBe("1895-07-24");
  });

  it("ignoră spațiile și caracterele non-cifrice", () => {
    expect(cnpToBirthDate(" 1 85 03 15 12 34 56 ")).toBe("1985-03-15");
  });

  it("respinge CNP cu lungime greșită", () => {
    expect(cnpToBirthDate("123456")).toBeNull();
    expect(cnpToBirthDate("12345678901234")).toBeNull();
  });

  it("respinge data imposibilă (31 februarie)", () => {
    expect(cnpToBirthDate("1850231123456")).toBeNull();
  });

  it("respinge luna invalidă", () => {
    expect(cnpToBirthDate("1851315123456")).toBeNull();
  });

  it("respinge null/undefined", () => {
    expect(cnpToBirthDate(null)).toBeNull();
    expect(cnpToBirthDate(undefined)).toBeNull();
    expect(cnpToBirthDate("")).toBeNull();
  });
});

describe("isValidCNP", () => {
  it("validează CNP-uri cu cifră de control corectă", () => {
    // Generăm un CNP valid manual: 1850315123451 → calculăm ultima cifră
    // S=1 a=8 b=5 m=0 n=3 z=1 j=5 j=1 j=2 n=3 n=4 n=5
    // suma = 1*2 + 8*7 + 5*9 + 0*1 + 3*4 + 1*6 + 5*3 + 1*5 + 2*8 + 3*2 + 4*7 + 5*9
    //      = 2 + 56 + 45 + 0 + 12 + 6 + 15 + 5 + 16 + 6 + 28 + 45 = 236
    // 236 % 11 = 5 → cifră de control = 5
    expect(isValidCNP("1850315123455")).toBe(true);
  });

  it("respinge CNP cu cifră de control greșită", () => {
    expect(isValidCNP("1850315123456")).toBe(false);
  });

  it("respinge CNP cu lungime greșită", () => {
    expect(isValidCNP("12345")).toBe(false);
  });
});

describe("normalizeIsoDate", () => {
  it("acceptă formatul ISO", () => {
    expect(normalizeIsoDate("1985-03-15")).toBe("1985-03-15");
    expect(normalizeIsoDate("1985-3-5")).toBe("1985-03-05");
  });

  it("convertește DD.MM.YYYY", () => {
    expect(normalizeIsoDate("15.03.1985")).toBe("1985-03-15");
    expect(normalizeIsoDate("5.3.1985")).toBe("1985-03-05");
  });

  it("convertește DD/MM/YYYY și DD-MM-YYYY", () => {
    expect(normalizeIsoDate("15/03/1985")).toBe("1985-03-15");
    expect(normalizeIsoDate("15-03-1985")).toBe("1985-03-15");
  });

  it("returnează null pentru input invalid", () => {
    expect(normalizeIsoDate("ceva ciudat")).toBeNull();
    expect(normalizeIsoDate(null)).toBeNull();
    expect(normalizeIsoDate(undefined)).toBeNull();
  });
});

describe("normalizeBuletinData", () => {
  it("derivă data nașterii din CNP, suprascrie OCR-ul greșit", () => {
    const result = normalizeBuletinData({
      cnp: "1850315123456",
      data_nasterii: "1986-03-15", // OCR a citit greșit anul (1986 în loc de 1985)
      nume: "Popescu",
      prenume: "Ion",
    });
    expect(result.data_nasterii).toBe("1985-03-15");
    expect(result.cnp).toBe("1850315123456");
  });

  it("folosește OCR ca fallback când CNP lipsește", () => {
    const result = normalizeBuletinData({
      data_nasterii: "15.03.1985",
    });
    expect(result.data_nasterii).toBe("1985-03-15");
  });

  it("returnează null când nu există nici CNP nici dată în OCR", () => {
    const result = normalizeBuletinData({ nume: "X" });
    expect(result.data_nasterii).toBeNull();
  });

  it("curăță CNP de spații/caractere", () => {
    const result = normalizeBuletinData({ cnp: " 1 85 03 15 12 34 56 " });
    expect(result.cnp).toBe("1850315123456");
    expect(result.data_nasterii).toBe("1985-03-15");
  });

  it("normalizează seria la uppercase și numarul la cifre", () => {
    const result = normalizeBuletinData({
      serie: " rr ",
      numar: "AB123456",
    });
    expect(result.serie).toBe("RR");
    expect(result.numar).toBe("123456");
  });

  it("acceptă input gol", () => {
    expect(normalizeBuletinData(null)).toEqual({ data_nasterii: null });
    expect(normalizeBuletinData(undefined)).toEqual({ data_nasterii: null });
    expect(normalizeBuletinData({})).toEqual({ data_nasterii: null });
  });
});
