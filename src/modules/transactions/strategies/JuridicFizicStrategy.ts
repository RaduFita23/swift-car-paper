import { BaseStrategy } from "./BaseStrategy";
import type { TransactionContext } from "./types";

export class JuridicFizicStrategy extends BaseStrategy {
  kind = "pj_pf" as const;
  label = "Persoană juridică → Persoană fizică";

  protected clauses(ctx: TransactionContext): string[] {
    return [
      ...super.clauses(ctx),
      "Vânzătorul (persoană juridică) va emite factură fiscală conform legislației în vigoare.",
    ];
  }

  protected tvaNote(ctx: TransactionContext): string | undefined {
    const tva = +(ctx.price * 0.19).toFixed(2);
    return `Notă TVA (19%): ${tva.toLocaleString("ro-RO")} ${ctx.currency} — inclus în preț dacă vânzătorul aplică TVA.`;
  }
}
