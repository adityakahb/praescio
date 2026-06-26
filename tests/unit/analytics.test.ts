import { describe, it, expect, vi } from 'vitest';
import { analytics } from '../../src/plugins/analytics';
import type { PraescioPublicAPI } from '../../src/types/Plugin';

type EventHandler = (...args: unknown[]) => void;

function makeInstance(): {
  instance: PraescioPublicAPI;
  emit: (event: string, ...args: unknown[]) => void;
} {
  const handlers: Record<string, EventHandler[]> = {};
  const instance = {
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event]!.push(handler);
      return () => undefined;
    }),
  } as unknown as PraescioPublicAPI;
  const emit = (event: string, ...args: unknown[]) => {
    handlers[event]?.forEach((h) => h(...args));
  };
  return { instance, emit };
}

// ── analytics plugin ──────────────────────────────────────────────────────────

describe('analytics — plugin metadata', () => {
  it('has name "analytics"', () => {
    expect(analytics({}).name).toBe('analytics');
  });
});

describe('analytics — onQuery', () => {
  it('fires onQuery when a query event is emitted', () => {
    const onQuery = vi.fn();
    const { instance, emit } = makeInstance();
    analytics({ onQuery }).install(instance);
    emit('query', 'hello');
    expect(onQuery).toHaveBeenCalledWith('hello');
  });

  it('does not register query listener when onQuery is not provided', () => {
    const { instance } = makeInstance();
    analytics({}).install(instance);
    const registeredEvents = (instance.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(registeredEvents).not.toContain('query');
  });
});

describe('analytics — onSelect', () => {
  it('fires onSelect with the item and the last query', () => {
    const onSelect = vi.fn();
    const onQuery = vi.fn();
    const { instance, emit } = makeInstance();
    analytics({ onSelect, onQuery }).install(instance);
    emit('query', 'par');
    emit('select', { type: 'text', label: 'Paris' });
    expect(onSelect).toHaveBeenCalledWith({ type: 'text', label: 'Paris' }, 'par');
  });

  it('does not register select listener when onSelect is not provided', () => {
    const { instance } = makeInstance();
    analytics({}).install(instance);
    const registeredEvents = (instance.on as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(registeredEvents).not.toContain('select');
  });
});

describe('analytics — onNoResults', () => {
  it('fires onNoResults when fetchEnd emits with zero items', () => {
    const onNoResults = vi.fn();
    const { instance, emit } = makeInstance();
    analytics({ onNoResults }).install(instance);
    emit('fetchEnd', 'noresult', []);
    expect(onNoResults).toHaveBeenCalledWith('noresult');
  });

  it('does not fire onNoResults when items are returned', () => {
    const onNoResults = vi.fn();
    const { instance, emit } = makeInstance();
    analytics({ onNoResults }).install(instance);
    emit('fetchEnd', 'query', [{ type: 'text', label: 'Paris' }]);
    expect(onNoResults).not.toHaveBeenCalled();
  });
});
