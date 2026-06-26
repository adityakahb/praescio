import type { PraescioPlugin } from '../types/Plugin';

interface FuzzyMatchOptions {
  /**
   * Maximum Levenshtein edit distance to consider a match.
   * Lower values = stricter matching. Default: `2`.
   */
  threshold?: number;
}

/** Compute Levenshtein distance between two strings (case-insensitive) */
function levenshtein(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  const m = al.length;
  const n = bl.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const row = dp[i];
      const prevRow = dp[i - 1];
      if (!row || !prevRow) continue;
      if (al[i - 1] === bl[j - 1]) {
        row[j] = prevRow[j - 1] ?? 0;
      } else {
        row[j] =
          1 + Math.min(prevRow[j] ?? Infinity, row[j - 1] ?? Infinity, prevRow[j - 1] ?? Infinity);
      }
    }
  }
  return dp[m]?.[n] ?? Infinity;
}

/**
 * A plugin that wraps the existing source with fuzzy matching.
 * Items whose label is within `threshold` edits of the query are included,
 * sorted by ascending distance.
 */
export function fuzzyMatch(opts: FuzzyMatchOptions = {}): PraescioPlugin {
  const threshold = opts.threshold ?? 2;

  return {
    name: 'fuzzyMatch',
    install(_instance, options): void {
      const originalSource = options.source;
      if (typeof originalSource !== 'function' && !Array.isArray(originalSource)) return;

      // Monkey-patch: wrap source to apply fuzzy filtering
      // Note: the transform is applied after normalisation in DataController.
      // For array sources, we can replace the source function.
      if (Array.isArray(originalSource)) {
        const items = originalSource as Array<{ label?: string } | string>;
        // Replace with a fuzzy-filtered async source
        (options as Record<string, unknown>)['source'] = async (query: string) => {
          return items
            .map((item) => {
              const label = typeof item === 'string' ? item : (item.label ?? '');
              const dist = levenshtein(query, label);
              return { item, dist };
            })
            .filter(({ dist }) => dist <= threshold)
            .sort((a, b) => a.dist - b.dist)
            .map(({ item }) => item);
        };
      }
    },
  };
}
