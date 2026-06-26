import type { SuggestionItem } from '../../types/SuggestionItem';
import type { CacheStrategy } from '../../types/PraescioOptions';

interface CacheEntry {
  items: SuggestionItem[];
  expiresAt: number;
}

export class CacheController {
  private store = new Map<string, CacheEntry>();
  private strategy: CacheStrategy;
  private ttl: number;

  constructor(strategy: CacheStrategy, ttl: number) {
    this.strategy = strategy;
    this.ttl = ttl;
  }

  get(query: string): SuggestionItem[] | null {
    if (this.strategy === 'none') return null;
    const entry = this.store.get(query);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(query);
      return null;
    }
    return entry.items;
  }

  set(query: string, items: SuggestionItem[]): void {
    if (this.strategy === 'none') return;
    this.store.set(query, { items, expiresAt: Date.now() + this.ttl });
  }

  has(query: string): boolean {
    return this.get(query) !== null;
  }

  clear(): void {
    this.store.clear();
  }
}
