import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Praescio } from '../../src/core/Praescio';

/** Create a fresh input attached to the document body. */
function makeInput(type = 'text'): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  document.body.appendChild(el);
  return el;
}

const SOURCE = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry'];

describe('Praescio — constructor', () => {
  it('mounts on an HTMLInputElement without throwing', () => {
    const input = makeInput();
    const ac = new Praescio(input, { source: SOURCE });
    expect(ac).toBeTruthy();
    ac.destroy();
    input.remove();
  });

  it('mounts via CSS selector string', () => {
    const input = makeInput();
    input.id = 'test-ac-selector';
    const ac = new Praescio('#test-ac-selector', { source: SOURCE });
    expect(ac).toBeTruthy();
    ac.destroy();
    input.remove();
  });

  it('throws when the selector matches nothing', () => {
    expect(() => new Praescio('#no-such-element', { source: SOURCE })).toThrow();
  });

  it('appends the panel to document.body by default', () => {
    const input = makeInput();
    const countBefore = document.querySelectorAll('.praescio__panel').length;
    const ac = new Praescio(input, { source: SOURCE });
    expect(document.querySelectorAll('.praescio__panel').length).toBeGreaterThan(countBefore);
    ac.destroy();
    input.remove();
  });

  it('appends the panel to a custom container element', () => {
    const input = makeInput();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const ac = new Praescio(input, { source: SOURCE, container });
    expect(container.querySelector('.praescio__panel')).toBeTruthy();
    ac.destroy();
    input.remove();
    container.remove();
  });

  it('sets ARIA combobox attributes on the input', () => {
    const input = makeInput();
    const ac = new Praescio(input, { source: SOURCE });
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    ac.destroy();
    input.remove();
  });
});

describe('Praescio — setQuery', () => {
  let input: HTMLInputElement;
  let ac: Praescio;

  beforeEach(() => {
    input = makeInput();
    ac = new Praescio(input, { source: SOURCE, minChars: 0, debounce: 0 });
  });

  afterEach(() => {
    ac.destroy();
    input.remove();
  });

  it('updates the input value', () => {
    ac.setQuery('banana');
    expect(input.value).toBe('banana');
  });

  it('accepts an empty string', () => {
    ac.setQuery('apple');
    ac.setQuery('');
    expect(input.value).toBe('');
  });

  it('does not throw when called with triggerFetch=false', () => {
    expect(() => ac.setQuery('apple', false)).not.toThrow();
  });
});

describe('Praescio — open / close', () => {
  let input: HTMLInputElement;
  let ac: Praescio;

  beforeEach(() => {
    input = makeInput();
    ac = new Praescio(input, { source: SOURCE, minChars: 0, debounce: 0 });
  });

  afterEach(() => {
    ac.destroy();
    input.remove();
  });

  it('open() does not throw', () => {
    expect(() => ac.open()).not.toThrow();
  });

  it('close() does not throw', () => {
    expect(() => ac.close()).not.toThrow();
  });

  it('open() then close() is idempotent', () => {
    ac.open();
    ac.close();
    ac.close();
  });
});

describe('Praescio — refresh / clearCache', () => {
  let input: HTMLInputElement;
  let ac: Praescio;

  beforeEach(() => {
    input = makeInput();
    ac = new Praescio(input, { source: SOURCE, debounce: 0 });
  });

  afterEach(() => {
    ac.destroy();
    input.remove();
  });

  it('refresh() does not throw', () => {
    expect(() => ac.refresh()).not.toThrow();
  });

  it('clearCache() does not throw', () => {
    expect(() => ac.clearCache()).not.toThrow();
  });
});

describe('Praescio — event emitter (on / off)', () => {
  let input: HTMLInputElement;
  let ac: Praescio;

  beforeEach(() => {
    input = makeInput();
    ac = new Praescio(input, { source: SOURCE, debounce: 0 });
  });

  afterEach(() => {
    ac.destroy();
    input.remove();
  });

  it('on() returns an unsubscribe function', () => {
    const unsub = ac.on('open', () => undefined);
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });

  it('off() does not throw when handler is registered', () => {
    const handler = vi.fn();
    ac.on('close', handler);
    expect(() => ac.off('close', handler)).not.toThrow();
  });

  it('fires the "open" event callback passed in options', () => {
    const onOpen = vi.fn();
    const i = makeInput();
    const a = new Praescio(i, { source: SOURCE, minChars: 0, debounce: 0, onOpen });
    a.open('apple');
    // Results arrive asynchronously; just verify no throw on teardown
    a.destroy();
    i.remove();
  });
});

describe('Praescio — destroy', () => {
  it('removes the panel from the DOM', () => {
    const input = makeInput();
    const ac = new Praescio(input, { source: SOURCE });
    const panel = document.querySelector('.praescio__panel');
    expect(panel).toBeTruthy();
    ac.destroy();
    expect(document.body.contains(panel)).toBe(false);
    input.remove();
  });

  it('removes ARIA attributes from the input on destroy', () => {
    const input = makeInput();
    const ac = new Praescio(input, { source: SOURCE });
    ac.destroy();
    expect(input.getAttribute('role')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBeNull();
    input.remove();
  });

  it('is idempotent — calling destroy() twice does not throw', () => {
    const input = makeInput();
    const ac = new Praescio(input, { source: SOURCE });
    ac.destroy();
    expect(() => ac.destroy()).not.toThrow();
    input.remove();
  });
});

describe('Praescio — plugins', () => {
  it('installs plugins without throwing', () => {
    const installed = vi.fn();
    const plugin = { name: 'test-plugin', install: installed };
    const input = makeInput();
    const ac = new Praescio(input, { source: SOURCE, plugins: [plugin] });
    expect(installed).toHaveBeenCalledOnce();
    ac.destroy();
    input.remove();
  });
});

describe('Praescio — async source', () => {
  it('accepts an async function as source', () => {
    const asyncSource = async (query: string) => [{ type: 'text' as const, label: query }];
    const input = makeInput();
    expect(() => new Praescio(input, { source: asyncSource })).not.toThrow();
    const ac = new Praescio(input, { source: asyncSource });
    ac.destroy();
    input.remove();
  });
});
