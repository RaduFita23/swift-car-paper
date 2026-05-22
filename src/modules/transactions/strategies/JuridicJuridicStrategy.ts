import { BaseStrategy } from "./BaseStrategy";
import type { TransactionContext } from "./types";

export class JuridicJuridicStrategy extends BaseStrategy {
  kind = "pj_pj" as const;
  label = "Persoană juridică → Persoană juridică";

  protected clauses(ctx: TransactionContext): string[] {
    return [
      ...super.clauses(ctx),
      "Operațiunea se va înregistra în contabilitatea ambelor societăți pe baza facturii fiscale emise de vânzător.",
      "Părțile aplică ștampila societății alături de semnătura reprezentantului legal.",
    ];
  }

  protected tvaNote(ctx: TransactionContext): string | undefined {
    const tva = +(ctx.price * 0.19).toFixed(2);
    return `TVA 19%: ${tva.toLocaleString("ro-RO")} ${ctx.currency}`;
  }
}
