import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../../src/utils/debounce';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('only calls fn once after the wait period', () => {
    const fn = vi.fn();
    const db = debounce(fn, 200);
    db('a');
    db('b');
    db('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('cancel prevents the pending call', () => {
    const fn = vi.fn();
    const db = debounce(fn, 200);
    db('a');
    db.cancel();
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush calls immediately without waiting', () => {
    const fn = vi.fn();
    const db = debounce(fn, 200);
    db('x');
    db.flush('y');
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('y');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledOnce(); // not called again
  });
});
