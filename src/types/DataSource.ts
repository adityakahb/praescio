/**
 * Async function that resolves suggestions for a given query.
 *
 * @param query - The current input string.
 * @param signal - An {@link AbortSignal} that fires when the request is
 *   superseded by a newer query; pass it to `fetch` to cancel in-flight requests.
 * @returns A promise that resolves to an array of raw items.
 *
 * @example
 * ```ts
 * const source: DataSourceFn<Product> = async (query, signal) => {
 *   const res = await fetch(`/api/products?q=${query}`, { signal });
 *   return res.json();
 * };
 * ```
 */
export type DataSourceFn<T> = (query: string, signal: AbortSignal) => Promise<T[]>;

/**
 * Flexible data source accepted by Praescio.
 *
 * Three forms are supported:
 * - **Array** – filtered in memory using a case-insensitive substring match on
 *   `item.label` (or the string value for plain-string arrays).
 * - **Function** – {@link DataSourceFn}; full control over fetching and filtering.
 * - **URL string** – a URL template containing `{query}` which is replaced with
 *   the percent-encoded query and fetched via `fetch`. The response must be a
 *   JSON array.
 *
 * @example Array source
 * ```ts
 * source: ['Apple', 'Banana', 'Cherry']
 * ```
 *
 * @example URL template
 * ```ts
 * source: 'https://api.example.com/search?q={query}'
 * ```
 */
export type DataSource<T> = T[] | DataSourceFn<T> | string; // URL template with {query} placeholder
