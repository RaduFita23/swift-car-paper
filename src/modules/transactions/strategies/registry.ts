import { container, token } from "@/lib/di/container";
import { FizicFizicStrategy } from "./FizicFizicStrategy";
import { FizicJuridicStrategy } from "./FizicJuridicStrategy";
import { JuridicFizicStrategy } from "./JuridicFizicStrategy";
import { JuridicJuridicStrategy } from "./JuridicJuridicStrategy";
import type { ContractStrategy, PersonType, TxKind } from "./types";
import { resolveKind } from "./types";

export const TOKENS = {
  pf_pf: token<ContractStrategy>("strategy.pf_pf"),
  pf_pj: token<ContractStrategy>("strategy.pf_pj"),
  pj_pf: token<ContractStrategy>("strategy.pj_pf"),
  pj_pj: token<ContractStrategy>("strategy.pj_pj"),
} as const;

let registered = false;
export function ensureStrategiesRegistered() {
  if (registered) return;
  container.register(TOKENS.pf_pf, () => new FizicFizicStrategy());
  container.register(TOKENS.pf_pj, () => new FizicJuridicStrategy());
  container.register(TOKENS.pj_pf, () => new JuridicFizicStrategy());
  container.register(TOKENS.pj_pj, () => new JuridicJuridicStrategy());
  registered = true;
}

export function getStrategy(seller: PersonType, buyer: PersonType): ContractStrategy {
  ensureStrategiesRegistered();
  const kind: TxKind = resolveKind(seller, buyer);
  return container.resolve(TOKENS[kind]);
}

export function getStrategyByKind(kind: TxKind): ContractStrategy {
  ensureStrategiesRegistered();
  return container.resolve(TOKENS[kind]);
}
