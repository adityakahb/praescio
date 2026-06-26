import { describe, it, expect } from 'vitest';
import { getHighlightSegments, buildHighlightFragment } from '../../src/utils/highlight';

describe('getHighlightSegments', () => {
  it('returns entire text as unmatched when query is empty', () => {
    const segs = getHighlightSegments('Paris', '');
    expect(segs).toEqual([{ text: 'Paris', matched: false }]);
  });

  it('marks a matching prefix', () => {
    const segs = getHighlightSegments('Paris', 'par');
    expect(segs[0]).toMatchObject({ text: 'Par', matched: true });
    expect(segs[1]).toMatchObject({ text: 'is', matched: false });
  });

  it('marks a mid-string match', () => {
    const segs = getHighlightSegments('Report: Paris data', 'Paris');
    expect(segs.some((s) => s.matched && s.text.toLowerCase() === 'paris')).toBe(true);
  });

  it('is case-insensitive', () => {
    const segs = getHighlightSegments('LONDON', 'lon');
    expect(segs[0]).toMatchObject({ matched: true });
    expect(segs[0]!.text.toLowerCase()).toBe('lon');
  });

  it('returns entire text as unmatched when no match', () => {
    const segs = getHighlightSegments('Madrid', 'xyz');
    expect(segs).toEqual([{ text: 'Madrid', matched: false }]);
  });

  it('marks multiple occurrences', () => {
    const segs = getHighlightSegments('aba', 'a');
    const matched = segs.filter((s) => s.matched);
    expect(matched).toHaveLength(2);
  });
});

// ── buildHighlightFragment ───────────────────────────────────────────────────

describe('buildHighlightFragment', () => {
  it('returns a DocumentFragment', () => {
    const frag = buildHighlightFragment('Paris', 'par');
    expect(frag.nodeType).toBe(Node.DOCUMENT_FRAGMENT_NODE);
  });

  it('wraps the matched portion in a <mark> with class praescio__highlight', () => {
    const frag = buildHighlightFragment('Paris', 'par');
    const div = document.createElement('div');
    div.appendChild(frag);
    const mark = div.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark!.className).toBe('praescio__highlight');
    expect(mark!.textContent!.toLowerCase()).toBe('par');
  });

  it('preserves unmatched text as text nodes', () => {
    const frag = buildHighlightFragment('Paris', 'par');
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.textContent).toBe('Paris');
  });

  it('returns a single text node when there is no match', () => {
    const frag = buildHighlightFragment('Madrid', 'xyz');
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelector('mark')).toBeNull();
    expect(div.textContent).toBe('Madrid');
  });

  it('handles an empty query (no marks)', () => {
    const frag = buildHighlightFragment('Berlin', '');
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelector('mark')).toBeNull();
    expect(div.textContent).toBe('Berlin');
  });

  it('creates marks for multiple occurrences', () => {
    const frag = buildHighlightFragment('banana', 'an');
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.querySelectorAll('mark')).toHaveLength(2);
  });

  it('uses textContent (not innerHTML) — safe against XSS input', () => {
    const frag = buildHighlightFragment('<b>bold</b>', '<b>');
    const div = document.createElement('div');
    div.appendChild(frag);
    const mark = div.querySelector('mark');
    // The mark's textContent is the literal string "<b>", not a child element
    expect(mark!.textContent).toBe('<b>');
    expect(mark!.querySelector('b')).toBeNull();
  });
});
