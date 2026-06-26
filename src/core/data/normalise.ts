import type { SuggestionItem } from '../../types/SuggestionItem';

/**
 * Coerce an unknown raw value into a {@link SuggestionItem}.
 *
 * Accepts:
 * - An already-typed `SuggestionItem` (detected by the presence of a `type` string) — passed through as-is.
 * - A plain `string` — wrapped as `{ type: 'text', label: string }`.
 * - A plain object with a `label` string — wrapped as a `TextItem`, optionally
 *   preserving `value` and `meta` if present.
 * - Anything else — coerced to a string label via `String(raw)`.
 */
export function normaliseItem(raw: unknown): SuggestionItem {
  if (typeof raw === 'string') {
    return { type: 'text', label: raw };
  }
  if (raw !== null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // Already a typed SuggestionItem
    if (typeof obj['type'] === 'string') {
      return raw as SuggestionItem;
    }
    // Duck-type { label }
    if (typeof obj['label'] === 'string') {
      return {
        type: 'text',
        label: obj['label'],
        value: typeof obj['value'] === 'string' ? obj['value'] : undefined,
        meta:
          typeof obj['meta'] === 'object' && obj['meta'] !== null
            ? (obj['meta'] as Record<string, unknown>)
            : undefined,
      };
    }
  }
  return { type: 'text', label: String(raw) };
}

/** Normalise an array of unknown values to an array of {@link SuggestionItem}. */
export function normaliseItems(raws: unknown[]): SuggestionItem[] {
  return raws.map(normaliseItem);
}
