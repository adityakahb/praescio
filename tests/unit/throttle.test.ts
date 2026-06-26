import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '../../src/utils/throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function on the first invocation', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('ignores subsequent calls within the throttle window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('allows a second call after the throttle window expires', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes arguments to the wrapped function', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a', 42);
    expect(fn).toHaveBeenCalledWith('a', 42);
  });

  it('dropped calls during the window do not execute later', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    throttled(); // dropped
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });
});
