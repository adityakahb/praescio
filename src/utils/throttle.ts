/**
 * Wrap `fn` so it can be called at most once every `limit` ms.
 * Calls that arrive during the throttle window are silently dropped.
 *
 * @example
 * ```ts
 * const onScroll = throttle(() => updatePanelPosition(), 16); // ~60fps
 * window.addEventListener('scroll', onScroll);
 * ```
 */
export function throttle<T extends unknown[]>(
  fn: (...args: T) => void,
  limit: number
): (...args: T) => void {
  let inThrottle = false;

  return function (...args: T): void {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
