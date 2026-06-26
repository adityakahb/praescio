import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recentSearches } from '../../src/plugins/recentSearches';
import type { PraescioPublicAPI } from '../../src/types/Plugin';
import type { PraescioOptions } from '../../src/types/PraescioOptions';

type EventHandler = (...args: unknown[]) => void;

const STORAGE_KEY = 'praescio_recent_test';

function makeInstance(): {
  instance: PraescioPublicAPI;
  emit: (event: string, ...args: unknown[]) => void;
} {
  const handlers: Record<string, EventHandler[]> = {};
  const instance = {
    open: vi.fn(),
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event]!.push(handler);
      // Return an unsubscribe function that removes this specific handler
      return () => {
        handlers[event] = (handlers[event] ?? []).filter((h) => h !== handler);
      };
    }),
  } as unknown as PraescioPublicAPI;
  return {
    instance,
    emit: (event, ...args) => handlers[event]?.forEach((h) => h(...args)),
  };
}

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

// ── recentSearches plugin ─────────────────────────────────────────────────────

describe('recentSearches — plugin metadata', () => {
  it('has name "recentSearches"', () => {
    expect(recentSearches().name).toBe('recentSearches');
  });
});

describe('recentSearches — persistence on select', () => {
  it('saves selected item label to localStorage', () => {
    const { instance, emit } = makeInstance();
    recentSearches({ storageKey: STORAGE_KEY }).install(instance, {} as Readonly<PraescioOptions>);
    emit('select', { type: 'text', label: 'Paris' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(stored).toContain('Paris');
  });

  it('does not store duplicate entries', () => {
    const { instance, emit } = makeInstance();
    recentSearches({ storageKey: STORAGE_KEY }).install(instance, {} as Readonly<PraescioOptions>);
    emit('select', { type: 'text', label: 'Paris' });
    emit('select', { type: 'text', label: 'Paris' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(stored.filter((v) => v === 'Paris').length).toBe(1);
  });

  it('places the latest selection first', () => {
    const { instance, emit } = makeInstance();
    recentSearches({ storageKey: STORAGE_KEY }).install(instance, {} as Readonly<PraescioOptions>);
    emit('select', { type: 'text', label: 'Paris' });
    emit('select', { type: 'text', label: 'London' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(stored[0]).toBe('London');
  });

  it('respects maxItems cap', () => {
    const { instance, emit } = makeInstance();
    recentSearches({ storageKey: STORAGE_KEY, maxItems: 3 }).install(
      instance,
      {} as Readonly<PraescioOptions>
    );
    ['A', 'B', 'C', 'D'].forEach((label) => {
      emit('select', { type: 'text', label });
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(stored.length).toBe(3);
  });

  it('does not store items with no label', () => {
    const { instance, emit } = makeInstance();
    recentSearches({ storageKey: STORAGE_KEY }).install(instance, {} as Readonly<PraescioOptions>);
    emit('select', { type: 'divider' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(stored.length).toBe(0);
  });
});

describe('recentSearches — destroy cleanup', () => {
  it('removes the select listener when destroy fires', () => {
    const { instance, emit } = makeInstance();
    recentSearches({ storageKey: STORAGE_KEY }).install(instance, {} as Readonly<PraescioOptions>);
    emit('destroy');
    emit('select', { type: 'text', label: 'Paris' });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    expect(stored.length).toBe(0);
  });
});
