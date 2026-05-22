
# Plan: AutoActe — platformă vânzare/cumpărare mașini

## Stack
- React + Vite + TypeScript + Tailwind + shadcn
- Lovable Cloud (auth, Postgres, Storage, Edge Functions)
- Lovable AI Gateway (Gemini vision pentru OCR)
- pdf-lib pentru generare PDF contract

## Paletă culori (index.css tokens HSL)
- Background: alb `0 0% 100%`
- Foreground: negru `0 0% 8%`
- Primary (green accent): `142 71% 35%`
- Muted/border: gri deschis
- Mod dark inversat (negru + verde)

## Module aplicație

```
src/
  modules/
    auth/              # signup/login, sesiune
    profile/           # persoană fizică / juridică
    documents/         # upload + storage + OCR
    vehicles/          # mașini deținute
    transactions/      # tranzacții vânzare-cumpărare
      strategies/      # strategy pattern (DI)
        ContractStrategy.ts        # interface
        FizicFizicStrategy.ts
        FizicJuridicStrategy.ts
        JuridicJuridicStrategy.ts
        StrategyFactory.ts
    contracts/         # generare PDF din template
    admin/             # dashboard admin
  lib/
    ocr/               # client OCR (apel edge function)
    pdf/               # generare PDF
    di/                # container simplu (token-based)
  pages/
  components/
```

## Arhitectură modulară & DI

**Interface `ContractStrategy`:**
```ts
interface ContractStrategy {
  requiredDocuments(): DocumentType[];
  validateParties(buyer: Party, seller: Party): ValidationResult;
  buildContractData(ctx: TransactionContext): ContractData;
  taxRules(): TaxRule[];
}
```

**Container DI** (simplu, fără librărie): `registerStrategy(key, factory)` + `resolveStrategy(buyerType, sellerType)`. Selectează implementarea pe baza combinației tipurilor (PF/PJ).

**Diferențe între strategii:**
- Fizic-Fizic: contract simplu, fără TVA, fără CUI
- Fizic-Juridic: necesită CUI, factură, regim TVA pentru vânzător PJ
- Juridic-Juridic: factură, TVA, ștampilă, reprezentant legal

## Schema DB (migrații)

- `profiles` (id → auth.users, person_type enum: 'fizica'|'juridica', nume, cnp, serie/nr buletin, adresa, telefon, email, + pentru juridica: denumire, cui, j, reprezentant)
- `user_roles` (user_id, role enum: 'admin'|'user') + funcție `has_role()` SECURITY DEFINER
- `vehicles` (id, owner_id, marca, model, an, vin, nr_inmatriculare, serie_civ, capacitate, culoare)
- `documents` (id, user_id, vehicle_id?, transaction_id?, type enum: 'buletin'|'cerere_inmatriculare'|'contract_vc'|'rca'|'plata_certificat'|'civ'|'talon', storage_path, ocr_data jsonb, status, uploaded_at)
- `transactions` (id, seller_id, buyer_id, vehicle_id, type: 'pf_pf'|'pf_pj'|'pj_pf'|'pj_pj', status: 'draft'|'docs_pending'|'ready'|'signed', price, currency, created_at)
- `contracts` (id, transaction_id, pdf_path, generated_at)

**RLS:** users → date proprii; admin (via `has_role`) → toate. Storage bucket privat `documents/{user_id}/...` cu policies pe owner.

## OCR (buletin → cont)

Edge function `ocr-document`:
1. Primește `documentId` + `type`
2. Descarcă fișierul din Storage (signed URL)
3. Trimite la `google/gemini-2.5-flash` cu prompt structurat (tool calling) pentru extragere: CNP, nume, prenume, serie, număr, adresă, data nașterii, sex, emis de, valabilitate
4. Salvează `ocr_data` în `documents`
5. Returnează către frontend → pre-populează formularul de signup/profil

Pentru celelalte acte (CIV, talon, RCA, etc.) similar, cu schema potrivită pe tip.

## Flux utilizator

1. **Signup**: upload buletin → OCR → preview date extrase → user confirmă/editează → cont creat
2. **Profil**: alege PF/PJ, completează date suplimentare (CUI etc. pentru PJ)
3. **Adaugă mașină**: upload CIV + talon → OCR populează datele
4. **Inițiază tranzacție**: alege mașina, introduce date cumpărător (caută user existent prin CNP/CUI sau invită)
5. **Upload acte necesare**: cerere înmatriculare, RCA, dovadă plată certificat (strategy decide lista exactă)
6. **Generare contract**: când toate docs uploaded → buton „Generează contract" → edge function `generate-contract` populează template PDF cu pdf-lib → salvează în Storage → download

## Edge Functions
- `ocr-document` — OCR via Lovable AI
- `generate-contract` — generare PDF contract (template ales după strategy)
- `validate-transaction` — verifică completitudine documente

## Pagini
- `/` Landing (hero, features)
- `/auth` Login/Signup cu upload buletin
- `/dashboard` Vehicule + tranzacții
- `/vehicles/:id` Detalii + documente
- `/transactions/new` Wizard creare tranzacție
- `/transactions/:id` Detalii, upload acte, generare contract
- `/admin` Doar admin: listă useri, tranzacții, audit

## Etape implementare
1. Setup Cloud, design tokens (alb/negru/verde), layout shell + landing
2. Auth + profiles (PF/PJ) + user_roles + RLS
3. Storage bucket + upload acte cu drag-drop
4. Edge function OCR + integrare în signup (preview date)
5. Vehicles CRUD + OCR pe CIV/talon
6. Module transactions + DI container + 3 strategii
7. Edge function generare PDF contract
8. Dashboard admin
9. Polish UI + validări (zod)

Confirmi planul ca să încep implementarea?
