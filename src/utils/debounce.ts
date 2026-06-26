/**
 * Wrap `fn` so it only executes after `wait` ms of silence.
 * Repeated calls within the window reset the timer.
 *
 * The returned function has two extra methods:
 * - `cancel()` — discard the pending invocation without calling `fn`.
 * - `flush(...args)` — call `fn` immediately, clearing any pending timer.
 *
 * @example
 * ```ts
 * const save = debounce((value: string) => api.save(value), 300);
 * input.addEventListener('input', (e) => save((e.target as HTMLInputElement).value));
 * ```
 */
export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  wait: number
): ((...args: T) => void) & { cancel(): void; flush(...args: T): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function debounced(...args: T): void {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, wait);
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  debounced.flush = (...args: T) => {
    clearTimeout(timer);
    timer = undefined;
    fn(...args);
  };

  return debounced;
}
