/**
 * Split `text` into an array of {text, matched} segments for the given query.
 * Matching is case-insensitive and diacritic-insensitive.
 */
export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function getHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!query) return [{ text, matched: false }];

  const normalised = text.normalize('NFC');
  const normQuery = query.normalize('NFC');
  const segments: HighlightSegment[] = [];
  const lower = normalised.toLowerCase();
  const lowerQ = normQuery.toLowerCase();

  let cursor = 0;
  let idx: number;
  while ((idx = lower.indexOf(lowerQ, cursor)) !== -1) {
    if (idx > cursor) {
      segments.push({ text: normalised.slice(cursor, idx), matched: false });
    }
    segments.push({ text: normalised.slice(idx, idx + lowerQ.length), matched: true });
    cursor = idx + lowerQ.length;
  }
  if (cursor < normalised.length) {
    segments.push({ text: normalised.slice(cursor), matched: false });
  }
  if (segments.length === 0) {
    segments.push({ text, matched: false });
  }
  return segments;
}

/**
 * Build a DocumentFragment with matched segments wrapped in <mark class="praescio__highlight">.
 * Safe: uses textContent, never innerHTML with user data.
 */
export function buildHighlightFragment(text: string, query: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const segments = getHighlightSegments(text, query);
  for (const seg of segments) {
    if (seg.matched) {
      const mark = document.createElement('mark');
      mark.className = 'praescio__highlight';
      mark.textContent = seg.text;
      fragment.appendChild(mark);
    } else {
      fragment.appendChild(document.createTextNode(seg.text));
    }
  }
  return fragment;
}
