import { describe, it, expect } from 'vitest';
import { renderItem } from '../../src/core/render/ItemRenderer';

// ── renderItem — all item types ───────────────────────────────────────────────

describe('renderItem — text', () => {
  it('returns a node with role="option"', () => {
    const { node } = renderItem({ type: 'text', label: 'Apple' }, '', false);
    expect(node.getAttribute('role')).toBe('option');
  });

  it('has no cleanup function', () => {
    const { cleanup } = renderItem({ type: 'text', label: 'Apple' }, '', false);
    expect(cleanup).toBeUndefined();
  });
});

describe('renderItem — description', () => {
  it('renders label and description text', () => {
    const { node } = renderItem(
      { type: 'description', label: 'TypeScript', description: 'Typed JS' },
      '',
      false
    );
    expect(node.querySelector('.praescio__item__label')!.textContent).toContain('TypeScript');
    expect(node.querySelector('.praescio__item__description')!.textContent).toBe('Typed JS');
  });
});

describe('renderItem — link', () => {
  it('renders an <a> element', () => {
    const { node } = renderItem({ type: 'link', label: 'Docs', href: '/docs' }, '', false);
    expect(node.tagName).toBe('A');
  });
});

describe('renderItem — icon', () => {
  it('renders an icon wrapper', () => {
    const { node } = renderItem({ type: 'icon', label: 'Settings', icon: 'fa fa-cog' }, '', false);
    expect(node.querySelector('.praescio__item__icon')).not.toBeNull();
  });
});

describe('renderItem — rich', () => {
  it('renders badge when provided', () => {
    const { node } = renderItem({ type: 'rich', label: 'Alice', badge: 'Admin' }, '', false);
    expect(node.querySelector('.praescio__item__badge')!.textContent).toBe('Admin');
  });

  it('renders as <a> when href present', () => {
    const { node } = renderItem({ type: 'rich', label: 'Link', href: '/p' }, '', false);
    expect(node.tagName).toBe('A');
  });
});

describe('renderItem — group', () => {
  it('renders with role="group"', () => {
    const { node } = renderItem({ type: 'group', label: 'Cities' }, '', false);
    expect(node.getAttribute('role')).toBe('group');
  });

  it('has no cleanup function', () => {
    const { cleanup } = renderItem({ type: 'group', label: 'Cities' }, '', false);
    expect(cleanup).toBeUndefined();
  });
});

describe('renderItem — divider', () => {
  it('renders an <hr> element', () => {
    const { node } = renderItem({ type: 'divider' }, '', false);
    expect(node.tagName).toBe('HR');
  });
});

describe('renderItem — custom', () => {
  it('calls render callback', () => {
    let called = false;
    renderItem(
      {
        type: 'custom',
        label: 'X',
        render: () => {
          called = true;
        },
      },
      'q',
      false
    );
    expect(called).toBe(true);
  });

  it('returns a cleanup function when render returns one', () => {
    const cleanup = () => undefined;
    const { cleanup: returned } = renderItem(
      { type: 'custom', label: 'X', render: () => cleanup },
      'q',
      false
    );
    expect(returned).toBe(cleanup);
  });

  it('generates a unique id for each item', () => {
    const { node: a } = renderItem({ type: 'text', label: 'A' }, '', false);
    const { node: b } = renderItem({ type: 'text', label: 'B' }, '', false);
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^praescio-item-/);
  });
});
