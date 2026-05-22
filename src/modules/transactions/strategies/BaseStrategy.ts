import type { ContractStrategy, ContractData, DocType, Party, TransactionContext, ValidationResult } from "./types";

export const COMMON_DOCS: DocType[] = [
  "buletin",
  "cerere_inmatriculare",
  "rca",
  "plata_certificat",
  "civ",
  "talon",
];

export function fizicaBlock(p: Party): string[] {
  return [
    `${p.nume ?? ""} ${p.prenume ?? ""}`.trim() || "—",
    `CNP: ${p.cnp ?? "—"}`,
    `BI/CI: ${p.serie_buletin ?? "—"} ${p.numar_buletin ?? ""}`,
    `Adresă: ${p.adresa ?? "—"}`,
    `Telefon: ${p.telefon ?? "—"}`,
  ];
}

export function juridicaBlock(p: Party): string[] {
  return [
    p.denumire_firma ?? "—",
    `CUI: ${p.cui ?? "—"} • Reg. Com.: ${p.nr_reg_com ?? "—"}`,
    `Reprezentant: ${p.reprezentant ?? "—"}`,
    `Sediu: ${p.adresa ?? "—"}`,
    `Telefon: ${p.telefon ?? "—"}`,
  ];
}

export function partyBlock(p: Party): string[] {
  return p.type === "juridica" ? juridicaBlock(p) : fizicaBlock(p);
}

export function vehicleBlock(ctx: TransactionContext): string[] {
  const v = ctx.vehicle;
  return [
    `${v.marca} ${v.model}${v.an ? ` (${v.an})` : ""}`,
    `Serie șasiu (VIN): ${v.vin ?? "—"}`,
    `Nr. înmatriculare: ${v.nr_inmatriculare ?? "—"}`,
    `Serie CIV: ${v.serie_civ ?? "—"}`,
    `Capacitate cilindrică: ${v.capacitate_cilindrica ?? "—"} cmc`,
    `Culoare: ${v.culoare ?? "—"}`,
  ];
}

export abstract class BaseStrategy implements ContractStrategy {
  abstract kind: ContractStrategy["kind"];
  abstract label: string;

  requiredDocuments(): DocType[] {
    return [...COMMON_DOCS];
  }

  validate(ctx: TransactionContext): ValidationResult {
    const req = this.requiredDocuments();
    const missing = req.filter((d) => !ctx.uploadedDocs.includes(d));
    const errors: string[] = [];
    if (!ctx.vehicle.vin) errors.push("VIN-ul mașinii este obligatoriu.");
    if (!ctx.price || ctx.price <= 0) errors.push("Prețul trebuie să fie pozitiv.");
    this.validateParties(ctx, errors);
    return { ok: missing.length === 0 && errors.length === 0, missing, errors };
  }

  protected validateParties(ctx: TransactionContext, errors: string[]) {
    for (const [name, p] of [["Vânzător", ctx.seller], ["Cumpărător", ctx.buyer]] as const) {
      if (p.type === "fizica" && (!p.cnp || !p.nume)) errors.push(`${name}: lipsesc datele de identitate.`);
      if (p.type === "juridica" && (!p.cui || !p.denumire_firma)) errors.push(`${name}: lipsesc datele firmei.`);
    }
  }

  buildContract(ctx: TransactionContext): ContractData {
    return {
      title: "CONTRACT DE VÂNZARE-CUMPĂRARE AUTOVEHICUL",
      sellerBlock: partyBlock(ctx.seller),
      buyerBlock: partyBlock(ctx.buyer),
      vehicleBlock: vehicleBlock(ctx),
      priceLine: `Preț: ${ctx.price.toLocaleString("ro-RO")} ${ctx.currency}`,
      clauses: this.clauses(ctx),
      tvaNote: this.tvaNote(ctx),
    };
  }

  protected clauses(_ctx: TransactionContext): string[] {
    return [
      "Vânzătorul declară că este unicul proprietar al autovehiculului și că acesta este liber de orice sarcini.",
      "Cumpărătorul a verificat starea autovehiculului și o acceptă ca atare.",
      "Plata prețului s-a efectuat integral la data semnării prezentului contract.",
      "Părțile se obligă să efectueze formalitățile de radiere și înmatriculare în termenele legale.",
      "Prezentul contract a fost redactat în 3 exemplare, câte unul pentru fiecare parte și unul pentru autoritatea de înmatriculare.",
    ];
  }

  protected tvaNote(_ctx: TransactionContext): string | undefined {
    return undefined;
  }
}
