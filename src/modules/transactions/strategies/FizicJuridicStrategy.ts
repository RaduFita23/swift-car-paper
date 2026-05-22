import { BaseStrategy } from "./BaseStrategy";
import type { TransactionContext } from "./types";

export class FizicJuridicStrategy extends BaseStrategy {
  kind = "pf_pj" as const;
  label = "Persoană fizică → Persoană juridică";

  protected clauses(ctx: TransactionContext): string[] {
    return [
      ...super.clauses(ctx),
      "Cumpărătorul (persoană juridică) va înregistra autovehiculul în patrimoniul societății conform reglementărilor contabile.",
    ];
  }
}
