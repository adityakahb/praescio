import { describe, it, expect } from 'vitest';
import { buildIcon } from '../../src/core/render/templates/icon';

// ── SVG strings ───────────────────────────────────────────────────────────────

describe('buildIcon — SVG string', () => {
  it('returns a wrapper span containing an <svg> element', () => {
    const wrapper = buildIcon('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper.querySelector('svg')).not.toBeNull();
  });

  it('sets aria-hidden and focusable=false on the SVG', () => {
    const wrapper = buildIcon('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');
    const svg = wrapper.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('strips on* event-handler attributes from the SVG root', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle/></svg>'
    );
    const svg = wrapper.querySelector('svg')!;
    expect(svg.getAttribute('onload')).toBeNull();
  });

  it('strips on* attributes from child elements', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg"><circle onclick="evil()" r="5"/></svg>'
    );
    const circle = wrapper.querySelector('circle')!;
    expect(circle.getAttribute('onclick')).toBeNull();
  });

  it('removes <script> elements inside SVG', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>'
    );
    expect(wrapper.querySelector('script')).toBeNull();
    expect(wrapper.querySelector('circle')).not.toBeNull();
  });

  it('strips javascript: href on SVG child elements', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle r="5"/></a></svg>'
    );
    const a = wrapper.querySelector('a')!;
    expect(a.getAttribute('href')).toBeNull();
  });
});

// ── <img> HTML string ─────────────────────────────────────────────────────────

describe('buildIcon — <img> tag string', () => {
  it('extracts the src and creates an <img> element', () => {
    const wrapper = buildIcon('<img src="/avatar.jpg" alt="Avatar">');
    const img = wrapper.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('avatar.jpg');
  });

  it('extracts the alt attribute from the <img> tag', () => {
    const wrapper = buildIcon('<img src="/avatar.jpg" alt="User photo">');
    expect(wrapper.querySelector('img')!.alt).toBe('User photo');
  });

  it('prefers the explicit alt argument over the tag attribute', () => {
    const wrapper = buildIcon('<img src="/avatar.jpg" alt="Tag alt">', 'Arg alt');
    expect(wrapper.querySelector('img')!.alt).toBe('Arg alt');
  });
});

// ── URL strings ───────────────────────────────────────────────────────────────

describe('buildIcon — URL string', () => {
  it('creates an <img> element for http URLs', () => {
    const wrapper = buildIcon('https://example.com/icon.png');
    expect(wrapper.querySelector('img')).not.toBeNull();
  });

  it('creates an <img> element for relative paths ending in an image extension', () => {
    const wrapper = buildIcon('/icons/star.svg');
    expect(wrapper.querySelector('img')).not.toBeNull();
  });

  it('sets alt="" and aria-hidden when no alt is provided', () => {
    const img = buildIcon('https://example.com/icon.png').querySelector('img')!;
    expect(img.alt).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets the provided alt and omits aria-hidden', () => {
    const img = buildIcon('https://example.com/icon.png', 'Star').querySelector('img')!;
    expect(img.alt).toBe('Star');
    expect(img.getAttribute('aria-hidden')).toBeNull();
  });
});

// ── CSS class string ──────────────────────────────────────────────────────────

describe('buildIcon — CSS class string', () => {
  it('creates a <span> with the given class', () => {
    const wrapper = buildIcon('fa fa-star');
    const span = wrapper.querySelector('span');
    expect(span).not.toBeNull();
    expect(span!.className).toBe('fa fa-star');
  });

  it('sets aria-hidden when no alt is provided', () => {
    const span = buildIcon('fa fa-star').querySelector('span')!;
    expect(span.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets aria-label when alt is provided', () => {
    const span = buildIcon('fa fa-star', 'Star icon').querySelector('span')!;
    expect(span.getAttribute('aria-label')).toBe('Star icon');
    expect(span.getAttribute('aria-hidden')).toBeNull();
  });
});

// ── SVG <use> external URL blocking ──────────────────────────────────────────

describe('buildIcon — SVG <use> element security', () => {
  it('removes <use> elements with external http href', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.com/evil.svg#icon"/><circle r="5"/></svg>'
    );
    expect(wrapper.querySelector('use')).toBeNull();
    expect(wrapper.querySelector('circle')).not.toBeNull();
  });

  it('removes <use> elements with xlink:href external URL', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<use xlink:href="https://evil.com/evil.svg#icon"/></svg>'
    );
    expect(wrapper.querySelector('use')).toBeNull();
  });

  it('preserves <use> elements with fragment-only href (same-document symbols)', () => {
    const wrapper = buildIcon(
      '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="icon"><circle r="5"/></symbol><use href="#icon"/></svg>'
    );
    expect(wrapper.querySelector('use')).not.toBeNull();
  });
});

// ── data: URL restriction in isUrl ────────────────────────────────────────────

describe('buildIcon — data: URL handling', () => {
  it('treats data:image/ URLs as image sources', () => {
    const wrapper = buildIcon('data:image/png;base64,abc123');
    expect(wrapper.querySelector('img')).not.toBeNull();
  });

  it('treats data:text/html as a CSS class (not a URL), avoiding img injection', () => {
    // data:text/html should fall through to the CSS-class branch, not buildImgIcon
    const wrapper = buildIcon('data:text/html,<script>alert(1)</script>');
    expect(wrapper.querySelector('img')).toBeNull();
  });
});
