import type { Tables } from "@/integrations/supabase/types";

export type PersonType = "fizica" | "juridica";
export type TxKind = "pf_pf" | "pf_pj" | "pj_pf" | "pj_pj";
export type DocType =
  | "buletin"
  | "cerere_inmatriculare"
  | "contract_vc"
  | "rca"
  | "plata_certificat"
  | "civ"
  | "talon";

export interface Party {
  type: PersonType;
  nume?: string | null;
  prenume?: string | null;
  cnp?: string | null;
  serie_buletin?: string | null;
  numar_buletin?: string | null;
  adresa?: string | null;
  email?: string | null;
  telefon?: string | null;
  denumire_firma?: string | null;
  cui?: string | null;
  nr_reg_com?: string | null;
  reprezentant?: string | null;
}

export interface VehicleData {
  marca: string;
  model: string;
  an?: number | null;
  vin?: string | null;
  nr_inmatriculare?: string | null;
  serie_civ?: string | null;
  capacitate_cilindrica?: number | null;
  culoare?: string | null;
}

export interface TransactionContext {
  seller: Party;
  buyer: Party;
  vehicle: VehicleData;
  price: number;
  currency: string;
  date: string;
  uploadedDocs: DocType[];
}

export interface ValidationResult {
  ok: boolean;
  missing: DocType[];
  errors: string[];
}

export interface ContractData {
  title: string;
  sellerBlock: string[];
  buyerBlock: string[];
  vehicleBlock: string[];
  priceLine: string;
  clauses: string[];
  tvaNote?: string;
}

export interface ContractStrategy {
  kind: TxKind;
  label: string;
  requiredDocuments(): DocType[];
  validate(ctx: TransactionContext): ValidationResult;
  buildContract(ctx: TransactionContext): ContractData;
}

export function resolveKind(seller: PersonType, buyer: PersonType): TxKind {
  return `${seller === "fizica" ? "pf" : "pj"}_${buyer === "fizica" ? "pf" : "pj"}` as TxKind;
}

export type ProfileRow = Tables<"profiles">;
export function profileToParty(p: ProfileRow | null | undefined): Party {
  if (!p) return { type: "fizica" };
  return {
    type: p.person_type,
    nume: p.nume,
    prenume: p.prenume,
    cnp: p.cnp,
    serie_buletin: p.serie_buletin,
    numar_buletin: p.numar_buletin,
    adresa: p.adresa,
    email: p.email,
    telefon: p.telefon,
    denumire_firma: p.denumire_firma,
    cui: p.cui,
    nr_reg_com: p.nr_reg_com,
    reprezentant: p.reprezentant,
  };
}
