import { describe, it, expect } from 'vitest';
import {
  sanitizeHref,
  el,
  contains,
  resolveElement,
  scrollableAncestors,
  injectStyles,
} from '../../src/utils/dom';

// ── sanitizeHref ─────────────────────────────────────────────────────────────

describe('sanitizeHref — blocked protocols', () => {
  it.each([
    ['javascript:alert(1)'],
    ['JAVASCRIPT:alert(1)'],
    ['JavaScript:void(0)'],
    ['vbscript:msgbox(1)'],
    ['VBSCRIPT:msgbox(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['data:image/png;base64,iVBORw0KGgo='],
  ])('replaces %s with "#"', (href) => {
    expect(sanitizeHref(href)).toBe('#');
  });

  it('strips leading whitespace before checking the protocol', () => {
    expect(sanitizeHref('  javascript:alert(1)')).toBe('#');
    expect(sanitizeHref('\njavascript:alert(1)')).toBe('#');
  });

  it('is resilient to space-separated protocol tricks', () => {
    expect(sanitizeHref('javas cript:alert(1)')).toBe('#');
  });

  it('is resilient to hyphen-separated protocol tricks', () => {
    expect(sanitizeHref('java-script:alert(1)')).toBe('#');
  });

  it('is resilient to tab-character protocol tricks', () => {
    expect(sanitizeHref('java\tscript:alert(1)')).toBe('#');
  });
});

describe('sanitizeHref — safe URLs pass through unchanged', () => {
  it.each([
    ['https://example.com'],
    ['http://example.com/path?q=1#hash'],
    ['//cdn.example.com/file.js'],
    ['/docs/api'],
    ['./relative/path'],
    ['../up/one'],
    ['#anchor'],
    ['mailto:user@example.com'],
    ['tel:+1234567890'],
  ])('passes through: %s', (href) => {
    expect(sanitizeHref(href)).toBe(href);
  });
});

// ── el ───────────────────────────────────────────────────────────────────────

describe('el', () => {
  it('creates an element with the given tag', () => {
    const node = el('div', {});
    expect(node.tagName).toBe('DIV');
  });

  it('sets attributes', () => {
    const node = el('a', { href: '/foo', class: 'link' });
    expect(node.getAttribute('href')).toBe('/foo');
    expect(node.className).toBe('link');
  });

  it('appends string children as text nodes', () => {
    const node = el('span', {}, 'hello');
    expect(node.textContent).toBe('hello');
  });

  it('appends Node children', () => {
    const child = document.createElement('strong');
    const node = el('p', {}, child);
    expect(node.firstChild).toBe(child);
  });
});

// ── resolveElement ───────────────────────────────────────────────────────────

describe('resolveElement', () => {
  it('returns the element when passed an HTMLElement directly', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(resolveElement(div)).toBe(div);
    div.remove();
  });

  it('queries the DOM when passed a selector string', () => {
    const div = document.createElement('div');
    div.id = 'test-resolve';
    document.body.appendChild(div);
    expect(resolveElement('#test-resolve')).toBe(div);
    div.remove();
  });

  it('throws when the selector matches nothing', () => {
    expect(() => resolveElement('#does-not-exist-xyz')).toThrow(/element not found/);
  });
});

// ── scrollableAncestors ───────────────────────────────────────────────────────

describe('scrollableAncestors', () => {
  it('returns an empty array when no ancestor is scrollable', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(scrollableAncestors(div)).toEqual([]);
    div.remove();
  });

  it('runs without error for a nested element', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(Array.isArray(scrollableAncestors(inner))).toBe(true);
    outer.remove();
  });
});

// ── injectStyles ──────────────────────────────────────────────────────────────

describe('injectStyles', () => {
  it('injects a <style> element into document.head', () => {
    const remove = injectStyles('test-style-id', 'body { color: red; }');
    const node = document.getElementById('test-style-id');
    expect(node).not.toBeNull();
    expect(node!.tagName).toBe('STYLE');
    remove();
  });

  it('returns a removal function that removes the style element', () => {
    const remove = injectStyles('test-style-remove', '.foo {}');
    expect(document.getElementById('test-style-remove')).not.toBeNull();
    remove();
    expect(document.getElementById('test-style-remove')).toBeNull();
  });

  it('is idempotent — does not inject a second element for the same id', () => {
    const r1 = injectStyles('test-style-idem', '.a {}');
    const r2 = injectStyles('test-style-idem', '.b {}');
    expect(document.querySelectorAll('#test-style-idem')).toHaveLength(1);
    r1();
    r2();
  });
});

// ── contains ─────────────────────────────────────────────────────────────────

describe('contains', () => {
  it('returns true when parent === child', () => {
    const div = document.createElement('div');
    expect(contains(div, div)).toBe(true);
  });

  it('returns true when child is a descendant', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(contains(parent, child)).toBe(true);
  });

  it('returns false for unrelated nodes', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    expect(contains(a, b)).toBe(false);
  });
});
