/** Simple type-safe DI container (token-based). */
export type Token<T> = { key: string; _t?: T };
export const token = <T>(key: string): Token<T> => ({ key });

type Factory<T> = () => T;

class Container {
  private registry = new Map<string, Factory<unknown>>();
  private singletons = new Map<string, unknown>();

  register<T>(t: Token<T>, factory: Factory<T>, singleton = true) {
    this.registry.set(t.key, singleton
      ? () => {
          if (!this.singletons.has(t.key)) this.singletons.set(t.key, factory());
          return this.singletons.get(t.key) as T;
        }
      : factory);
  }

  resolve<T>(t: Token<T>): T {
    const f = this.registry.get(t.key);
    if (!f) throw new Error(`DI: unregistered token ${t.key}`);
    return f() as T;
  }
}

export const container = new Container();
