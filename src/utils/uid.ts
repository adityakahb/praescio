let counter = 0;

/**
 * Generate a page-unique ID string, e.g. `"praescio-1"`, `"praescio-2"`.
 * Used to create stable `id` attributes for ARIA relationships
 * (combobox `aria-controls`, listbox `id`, etc.).
 *
 * @param prefix - Optional prefix. Defaults to `"praescio"`.
 */
export function uid(prefix = 'praescio'): string {
  return `${prefix}-${++counter}`;
}
