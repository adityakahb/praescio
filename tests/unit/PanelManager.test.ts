import { describe, it, expect } from 'vitest';
import { buildPanelShell, PanelManager } from '../../src/core/render/PanelManager';
import { ListRenderer } from '../../src/core/render/ListRenderer';
import type { CommonOptions } from '../../src/types/PraescioOptions';

const BASE_OPTIONS: CommonOptions = {
  highlight: true,
  minChars: 1,
  maxItems: 10,
  cache: 'none',
  cacheTTL: 0,
  selectOnTab: true,
  closeOnSelect: true,
  openOnFocus: false,
  showEmpty: true,
  virtualScroll: false,
  placement: 'auto',
  offset: 4,
  debounce: 300,
  ariaLabel: 'Suggestions',
  plugins: [],
} as unknown as CommonOptions;

function makeRenderer(): ListRenderer {
  return new ListRenderer('list-test', {
    highlight: true,
    minChars: 1,
    maxItems: 10,
    cache: 'query',
    cacheTTL: 300_000,
    selectOnTab: true,
    closeOnSelect: true,
    openOnFocus: false,
    showEmpty: true,
    virtualScroll: 'auto',
    placement: 'auto',
    offset: 4,
    debounce: 300,
    ariaLabel: 'Suggestions',
    plugins: [],
  } as never);
}

// ── buildPanelShell ──────────────────────────────────────────────────────────

describe('buildPanelShell', () => {
  it('creates a div with class praescio__panel and given id', () => {
    const renderer = makeRenderer();
    const panel = buildPanelShell('panel-1', renderer.listEl, undefined);
    expect(panel.tagName).toBe('DIV');
    expect(panel.classList.contains('praescio__panel')).toBe(true);
    expect(panel.id).toBe('panel-1');
  });

  it('appends the listEl as a child', () => {
    const renderer = makeRenderer();
    const panel = buildPanelShell('panel-2', renderer.listEl, undefined);
    expect(panel.contains(renderer.listEl)).toBe(true);
  });

  it('renders a string header slot', () => {
    const renderer = makeRenderer();
    const panel = buildPanelShell('panel-3', renderer.listEl, { header: 'My Header' });
    const header = panel.querySelector('.praescio__panel__header');
    expect(header).not.toBeNull();
    expect(header!.textContent).toBe('My Header');
  });

  it('renders an HTMLElement header slot', () => {
    const renderer = makeRenderer();
    const headerEl = document.createElement('span');
    headerEl.textContent = 'Custom';
    const panel = buildPanelShell('panel-4', renderer.listEl, { header: headerEl });
    const header = panel.querySelector('.praescio__panel__header');
    expect(header).not.toBeNull();
    expect(header!.contains(headerEl)).toBe(true);
  });

  it('renders an HTMLElement footer slot', () => {
    const renderer = makeRenderer();
    const footerEl = document.createElement('div');
    footerEl.textContent = 'Footer';
    const panel = buildPanelShell('panel-5', renderer.listEl, { footer: footerEl as never });
    const footer = panel.querySelector('.praescio__panel__footer');
    expect(footer).not.toBeNull();
  });

  it('omits header and footer when slots are undefined', () => {
    const renderer = makeRenderer();
    const panel = buildPanelShell('panel-6', renderer.listEl, undefined);
    expect(panel.querySelector('.praescio__panel__header')).toBeNull();
    expect(panel.querySelector('.praescio__panel__footer')).toBeNull();
  });
});

// ── PanelManager class ────────────────────────────────────────────────────────

function makePanelManager(): PanelManager {
  const panel = document.createElement('div');
  const anchor = document.createElement('input');
  document.body.appendChild(anchor);
  return new PanelManager(panel, anchor, BASE_OPTIONS);
}

describe('PanelManager — construction', () => {
  it('sets position absolute and display none on the panel', () => {
    const pm = makePanelManager();
    expect(pm.panel.style.position).toBe('absolute');
    expect(pm.panel.style.display).toBe('none');
  });
});

describe('PanelManager — open / close', () => {
  it('open() makes the panel visible', () => {
    const pm = makePanelManager();
    pm.open();
    expect(pm.panel.style.display).not.toBe('none');
  });

  it('close() hides the panel', () => {
    const pm = makePanelManager();
    pm.open();
    pm.close();
    expect(pm.panel.style.display).toBe('none');
  });

  it('open() is idempotent — calling twice does not throw', () => {
    const pm = makePanelManager();
    expect(() => {
      pm.open();
      pm.open();
    }).not.toThrow();
  });

  it('close() is idempotent — calling twice does not throw', () => {
    const pm = makePanelManager();
    expect(() => {
      pm.close();
      pm.close();
    }).not.toThrow();
  });
});

describe('PanelManager — destroy', () => {
  it('removes the panel element from the DOM', () => {
    const pm = makePanelManager();
    document.body.appendChild(pm.panel);
    pm.destroy();
    expect(document.body.contains(pm.panel)).toBe(false);
  });

  it('closes the panel before removing it', () => {
    const pm = makePanelManager();
    document.body.appendChild(pm.panel);
    pm.open();
    pm.destroy();
    expect(document.body.contains(pm.panel)).toBe(false);
  });
});

describe('PanelManager — reposition', () => {
  it('does nothing when the panel is closed', () => {
    const pm = makePanelManager();
    expect(() => pm.reposition()).not.toThrow();
  });

  it('sets top/left/width on the panel when open', () => {
    const pm = makePanelManager();
    pm.open();
    expect(pm.panel.style.top).toBeDefined();
    expect(pm.panel.style.left).toBeDefined();
    expect(pm.panel.style.width).toBeDefined();
  });
});
