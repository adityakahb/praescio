import { describe, it, expect, vi } from 'vitest';
import { renderTextItem } from '../../src/core/render/templates/TextItem';
import { renderDescriptionItem } from '../../src/core/render/templates/DescriptionItem';
import { renderLinkItem } from '../../src/core/render/templates/LinkItem';
import { renderIconItem } from '../../src/core/render/templates/IconItem';
import { renderRichItem } from '../../src/core/render/templates/RichItem';
import { renderGroupHeader } from '../../src/core/render/templates/GroupHeader';
import { renderDivider } from '../../src/core/render/templates/DividerItem';
import { renderCustomItem } from '../../src/core/render/templates/CustomItem';

// ── Shared ARIA checks ───────────────────────────────────────────────────────

function isSelectableOption(el: HTMLElement): boolean {
  return (
    el.getAttribute('role') === 'option' &&
    el.getAttribute('aria-selected') === 'false' &&
    el.getAttribute('tabindex') === '-1'
  );
}

// ── TextItem ─────────────────────────────────────────────────────────────────

describe('renderTextItem', () => {
  it('renders a div option with the label text', () => {
    const node = renderTextItem({ type: 'text', label: 'Apple' }, 'id-1', '', false);
    expect(node.tagName).toBe('DIV');
    expect(isSelectableOption(node)).toBe(true);
    expect(node.textContent).toContain('Apple');
  });

  it('wraps matched text in <mark> when highlight=true', () => {
    const node = renderTextItem({ type: 'text', label: 'Apple' }, 'id-1', 'app', true);
    expect(node.querySelector('mark')).not.toBeNull();
    expect(node.querySelector('mark')!.textContent).toBe('App');
  });

  it('does not add <mark> when highlight=false', () => {
    const node = renderTextItem({ type: 'text', label: 'Apple' }, 'id-1', 'app', false);
    expect(node.querySelector('mark')).toBeNull();
  });

  it('assigns the given itemId', () => {
    const node = renderTextItem({ type: 'text', label: 'Apple' }, 'my-id', '', false);
    expect(node.id).toBe('my-id');
  });
});

// ── DescriptionItem ──────────────────────────────────────────────────────────

describe('renderDescriptionItem', () => {
  it('renders label and description text', () => {
    const node = renderDescriptionItem(
      { type: 'description', label: 'TypeScript', description: 'Typed JS' },
      'id-2',
      '',
      false
    );
    expect(node.querySelector('.praescio__item__label')!.textContent).toContain('TypeScript');
    expect(node.querySelector('.praescio__item__description')!.textContent).toBe('Typed JS');
  });

  it('is a selectable option', () => {
    const node = renderDescriptionItem(
      { type: 'description', label: 'TS', description: 'desc' },
      'id-2',
      '',
      false
    );
    expect(isSelectableOption(node)).toBe(true);
  });

  it('highlights the label when highlight=true', () => {
    const node = renderDescriptionItem(
      { type: 'description', label: 'TypeScript', description: 'Typed JS' },
      'id-2',
      'type',
      true
    );
    expect(node.querySelector('mark')).not.toBeNull();
  });
});

// ── LinkItem ─────────────────────────────────────────────────────────────────

describe('renderLinkItem', () => {
  it('renders as an <a> element', () => {
    const node = renderLinkItem({ type: 'link', label: 'Docs', href: '/docs' }, 'id-3', '', false);
    expect(node.tagName).toBe('A');
    expect(isSelectableOption(node)).toBe(true);
  });

  it('sets the href attribute from item.href', () => {
    const node = renderLinkItem(
      { type: 'link', label: 'Docs', href: '/docs' },
      'id-3',
      '',
      false
    ) as HTMLAnchorElement;
    expect(node.getAttribute('href')).toBe('/docs');
  });

  it('sanitizes javascript: hrefs to "#"', () => {
    const node = renderLinkItem(
      { type: 'link', label: 'Bad', href: 'javascript:alert(1)' },
      'id-3',
      '',
      false
    ) as HTMLAnchorElement;
    expect(node.getAttribute('href')).toBe('#');
  });

  it('defaults target to _self', () => {
    const node = renderLinkItem({ type: 'link', label: 'Docs', href: '/docs' }, 'id-3', '', false);
    expect(node.getAttribute('target')).toBe('_self');
  });

  it('adds rel="noopener noreferrer" for _blank target', () => {
    const node = renderLinkItem(
      { type: 'link', label: 'Ext', href: 'https://example.com', target: '_blank' },
      'id-3',
      '',
      false
    );
    expect(node.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders an optional description', () => {
    const node = renderLinkItem(
      { type: 'link', label: 'Docs', href: '/docs', description: 'API reference' },
      'id-3',
      '',
      false
    );
    expect(node.querySelector('.praescio__item__description')!.textContent).toBe('API reference');
  });

  it('highlights label text', () => {
    const node = renderLinkItem(
      { type: 'link', label: 'GitHub', href: 'https://github.com' },
      'id-3',
      'git',
      true
    );
    expect(node.querySelector('mark')!.textContent!.toLowerCase()).toBe('git');
  });
});

// ── IconItem ─────────────────────────────────────────────────────────────────

describe('renderIconItem', () => {
  it('renders an icon wrapper and label', () => {
    const node = renderIconItem(
      { type: 'icon', label: 'Settings', icon: 'fa fa-cog' },
      'id-4',
      '',
      false
    );
    expect(node.querySelector('.praescio__item__icon')).not.toBeNull();
    expect(node.querySelector('.praescio__item__label')!.textContent).toContain('Settings');
  });

  it('is a selectable option', () => {
    const node = renderIconItem(
      { type: 'icon', label: 'Settings', icon: 'fa fa-cog' },
      'id-4',
      '',
      false
    );
    expect(isSelectableOption(node)).toBe(true);
  });
});

// ── RichItem ─────────────────────────────────────────────────────────────────

describe('renderRichItem', () => {
  it('renders as a <div> when no href', () => {
    const node = renderRichItem(
      { type: 'rich', label: 'Alice', description: 'Engineering' },
      'id-5',
      '',
      false
    );
    expect(node.tagName).toBe('DIV');
  });

  it('renders as an <a> when href is provided', () => {
    const node = renderRichItem(
      { type: 'rich', label: 'Alice', href: '/profile' },
      'id-5',
      '',
      false
    );
    expect(node.tagName).toBe('A');
    expect(node.getAttribute('href')).toBe('/profile');
  });

  it('sanitizes javascript: href', () => {
    const node = renderRichItem(
      { type: 'rich', label: 'Bad', href: 'javascript:alert(1)' },
      'id-5',
      '',
      false
    );
    expect(node.getAttribute('href')).toBe('#');
  });

  it('renders badge text', () => {
    const node = renderRichItem(
      { type: 'rich', label: 'Alice', badge: 'Admin' },
      'id-5',
      '',
      false
    );
    expect(node.querySelector('.praescio__item__badge')!.textContent).toBe('Admin');
  });

  it('renders description', () => {
    const node = renderRichItem(
      { type: 'rich', label: 'Alice', description: 'Engineering · Berlin' },
      'id-5',
      '',
      false
    );
    expect(node.querySelector('.praescio__item__description')!.textContent).toBe(
      'Engineering · Berlin'
    );
  });

  it('adds rel="noopener noreferrer" for _blank', () => {
    const node = renderRichItem(
      { type: 'rich', label: 'Link', href: 'https://x.com', target: '_blank' },
      'id-5',
      '',
      false
    );
    expect(node.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('is a selectable option', () => {
    const node = renderRichItem({ type: 'rich', label: 'Alice' }, 'id-5', '', false);
    expect(isSelectableOption(node)).toBe(true);
  });
});

// ── GroupHeader ───────────────────────────────────────────────────────────────

describe('renderGroupHeader', () => {
  it('renders a div with role="group"', () => {
    const node = renderGroupHeader({ type: 'group', label: 'Recent' }, 'g-1');
    expect(node.tagName).toBe('DIV');
    expect(node.getAttribute('role')).toBe('group');
    expect(node.getAttribute('aria-label')).toBe('Recent');
  });

  it('renders the label text', () => {
    const node = renderGroupHeader({ type: 'group', label: 'Recent' }, 'g-1');
    expect(node.querySelector('.praescio__group__label')!.textContent).toContain('Recent');
  });

  it('renders an icon span when icon is provided', () => {
    const node = renderGroupHeader({ type: 'group', label: 'Recent', icon: 'fa fa-clock' }, 'g-1');
    expect(node.querySelector('.praescio__item__icon')).not.toBeNull();
  });

  it('omits the icon element when no icon is provided', () => {
    const node = renderGroupHeader({ type: 'group', label: 'Recent' }, 'g-1');
    expect(node.querySelector('.praescio__item__icon')).toBeNull();
  });
});

// ── DividerItem ───────────────────────────────────────────────────────────────

describe('renderDivider', () => {
  it('renders an <hr> with role="separator" and aria-hidden="true"', () => {
    const node = renderDivider();
    expect(node.tagName).toBe('HR');
    expect(node.getAttribute('role')).toBe('separator');
    expect(node.getAttribute('aria-hidden')).toBe('true');
  });
});

// ── CustomItem ────────────────────────────────────────────────────────────────

describe('renderCustomItem — render callback', () => {
  it('calls render with the container and query', () => {
    const render = vi.fn();
    renderCustomItem({ type: 'custom', label: 'Custom', render }, 'id-6', 'hello');
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0]![1]).toBe('hello');
  });

  it('returns the cleanup function returned by render', () => {
    const cleanup = vi.fn();
    const { cleanup: returned } = renderCustomItem(
      { type: 'custom', label: 'Custom', render: () => cleanup },
      'id-6',
      ''
    );
    expect(returned).toBe(cleanup);
  });

  it('returns undefined cleanup when render returns void', () => {
    const { cleanup } = renderCustomItem(
      { type: 'custom', label: 'Custom', render: () => {} },
      'id-6',
      ''
    );
    expect(cleanup).toBeUndefined();
  });

  it('is a selectable option', () => {
    const { node } = renderCustomItem(
      { type: 'custom', label: 'Custom', render: () => {} },
      'id-6',
      ''
    );
    expect(isSelectableOption(node)).toBe(true);
  });
});

describe('renderCustomItem — html shorthand', () => {
  it('sets innerHTML when no render callback is provided', () => {
    const { node } = renderCustomItem(
      { type: 'custom', label: 'Product', html: '<strong>Bold</strong>' },
      'id-7',
      ''
    );
    expect(node.querySelector('strong')!.textContent).toBe('Bold');
  });

  it('render callback takes precedence over html', () => {
    const render = vi.fn();
    renderCustomItem(
      { type: 'custom', label: 'Product', html: '<strong>ignored</strong>', render },
      'id-7',
      ''
    );
    expect(render).toHaveBeenCalledOnce();
  });

  it('leaves the container empty when neither render nor html is provided', () => {
    const { node } = renderCustomItem({ type: 'custom', label: 'Empty' }, 'id-7', '');
    expect(node.innerHTML).toBe('');
  });
});
