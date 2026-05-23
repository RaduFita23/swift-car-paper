import { describe, it, expect } from "vitest";
import {
  mapVehicleOcr,
  normalizeColor,
  normalizeIntFromString,
  normalizeIsoDate,
  normalizeVIN,
  normalizeYear,
} from "@/lib/ocr/vehicle";

describe("normalizeColor", () => {
  it("traduce culorile din engleză în română", () => {
    expect(normalizeColor("white")).toBe("Alb");
    expect(normalizeColor("BLACK")).toBe("Negru");
    expect(normalizeColor("Red")).toBe("Roșu");
    expect(normalizeColor("silver")).toBe("Argintiu");
  });

  it("capitalizează corect culoarea în română", () => {
    expect(normalizeColor("alb")).toBe("Alb");
    expect(normalizeColor("ALBASTRU")).toBe("Albastru");
    expect(normalizeColor(" gri ")).toBe("Gri");
  });

  it("returnează null pentru valori goale/invalide", () => {
    expect(normalizeColor("")).toBeNull();
    expect(normalizeColor(null)).toBeNull();
    expect(normalizeColor(undefined)).toBeNull();
    expect(normalizeColor(123)).toBeNull();
  });
});

describe("normalizeIntFromString", () => {
  it("acceptă numere direct", () => {
    expect(normalizeIntFromString(1968)).toBe(1968);
    expect(normalizeIntFromString(1968.7)).toBe(1969);
  });

  it("extrage numere din strings cu unități", () => {
    expect(normalizeIntFromString("1968 cm³")).toBe(1968);
    expect(normalizeIntFromString("1968cmc")).toBe(1968);
    expect(normalizeIntFromString("1.968 cm3")).toBe(1);
  });

  it("returnează null pentru input invalid", () => {
    expect(normalizeIntFromString("fără cifre")).toBeNull();
    expect(normalizeIntFromString(null)).toBeNull();
    expect(normalizeIntFromString(undefined)).toBeNull();
  });
});

describe("normalizeYear", () => {
  it("acceptă ani validi", () => {
    expect(normalizeYear(2018)).toBe(2018);
    expect(normalizeYear("2020")).toBe(2020);
    expect(normalizeYear(1995)).toBe(1995);
  });

  it("respinge ani imposibili", () => {
    expect(normalizeYear(1850)).toBeNull();
    expect(normalizeYear(3000)).toBeNull();
    expect(normalizeYear("abc")).toBeNull();
    expect(normalizeYear(null)).toBeNull();
  });
});

describe("normalizeVIN", () => {
  it("face uppercase și elimină spațiile", () => {
    expect(normalizeVIN("wvwzzz1jzxw000001")).toBe("WVWZZZ1JZXW000001");
    expect(normalizeVIN(" WVWZZZ 1JZXW 000001 ")).toBe("WVWZZZ1JZXW000001");
  });

  it("returnează null pentru valori goale", () => {
    expect(normalizeVIN("")).toBeNull();
    expect(normalizeVIN(null)).toBeNull();
  });
});

describe("mapVehicleOcr", () => {
  it("mapează corect un răspuns OCR de talon complet", () => {
    const ocr = {
      marca: "dacia",
      model: "Logan",
      vin: "uu1lsda1234567890",
      an_fabricatie: 2018,
      capacitate_cilindrica: "1461 cmc",
      culoare: "white",
      nr_inmatriculare: "b 123 abc",
    };
    const result = mapVehicleOcr(ocr);
    expect(result).toEqual({
      marca: "DACIA",
      model: "Logan",
      vin: "UU1LSDA1234567890",
      an: 2018,
      capacitate_cilindrica: 1461,
      culoare: "Alb",
      nr_inmatriculare: "B123ABC",
    });
  });

  it("ignoră câmpurile lipsă (nu suprascrie cu undefined)", () => {
    const result = mapVehicleOcr({ marca: "BMW", model: "X5" });
    expect(result).toEqual({ marca: "BMW", model: "X5" });
    expect("an" in result).toBe(false);
    expect("culoare" in result).toBe(false);
  });

  it("respinge anul invalid (nu îl include)", () => {
    const result = mapVehicleOcr({ marca: "BMW", an_fabricatie: 1850 });
    expect(result.an).toBeUndefined();
  });

  it("acceptă și CIV cu serie_civ", () => {
    const result = mapVehicleOcr({ serie_civ: "a0123456" });
    expect(result.serie_civ).toBe("A0123456");
  });

  it("acceptă input gol/null", () => {
    expect(mapVehicleOcr(null)).toEqual({});
    expect(mapVehicleOcr(undefined)).toEqual({});
    expect(mapVehicleOcr({})).toEqual({});
  });

  it("normalizează capacitate cilindrică din string cu unitate", () => {
    expect(mapVehicleOcr({ capacitate_cilindrica: "1968 cm³" }).capacitate_cilindrica).toBe(1968);
    expect(mapVehicleOcr({ capacitate_cilindrica: "999cmc" }).capacitate_cilindrica).toBe(999);
  });

  it("mapează `itp_data_expirare` (de pe talon) la `itp_expira_la`", () => {
    expect(mapVehicleOcr({ itp_data_expirare: "16.05.2027" }).itp_expira_la).toBe("2027-05-16");
    expect(mapVehicleOcr({ itp_data_expirare: "2027-05-16" }).itp_expira_la).toBe("2027-05-16");
  });

  it("acceptă și `data_expirare` (de pe certificatul ITP) ca fallback", () => {
    expect(mapVehicleOcr({ data_expirare: "31.12.2026" }).itp_expira_la).toBe("2026-12-31");
  });

  it("preferă `itp_data_expirare` față de `data_expirare` dacă ambele există", () => {
    const result = mapVehicleOcr({
      itp_data_expirare: "01.01.2028",
      data_expirare: "01.01.2025",
    });
    expect(result.itp_expira_la).toBe("2028-01-01");
  });

  it("ignoră date ITP invalide", () => {
    expect(mapVehicleOcr({ itp_data_expirare: "" }).itp_expira_la).toBeUndefined();
    expect(mapVehicleOcr({ itp_data_expirare: "neclar" }).itp_expira_la).toBeUndefined();
    expect(mapVehicleOcr({}).itp_expira_la).toBeUndefined();
  });
});

describe("normalizeIsoDate", () => {
  it("acceptă formatul ISO YYYY-MM-DD", () => {
    expect(normalizeIsoDate("2027-05-16")).toBe("2027-05-16");
    expect(normalizeIsoDate("2027-5-6")).toBe("2027-05-06");
  });

  it("convertește DD.MM.YYYY (formatul scris de mână pe talon)", () => {
    expect(normalizeIsoDate("16.05.2027")).toBe("2027-05-16");
    expect(normalizeIsoDate("5.5.2027")).toBe("2027-05-05");
  });

  it("acceptă DD/MM/YYYY și DD-MM-YYYY", () => {
    expect(normalizeIsoDate("16/05/2027")).toBe("2027-05-16");
    expect(normalizeIsoDate("16-05-2027")).toBe("2027-05-16");
  });

  it("returnează null pentru input invalid", () => {
    expect(normalizeIsoDate("text aleator")).toBeNull();
    expect(normalizeIsoDate("")).toBeNull();
    expect(normalizeIsoDate(null)).toBeNull();
    expect(normalizeIsoDate(undefined)).toBeNull();
    expect(normalizeIsoDate(123)).toBeNull();
  });
});
