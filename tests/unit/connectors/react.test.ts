import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReactPraescio } from '../../../src/connectors/react';
import type { ReactHooksLike, ReactReadonlyRef } from '../../../src/connectors/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(): HTMLInputElement {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return el;
}

/**
 * Build a minimal ReactHooksLike mock that captures the effect callback and
 * the ref so tests can invoke them synchronously.
 */
function makeReactMock(): {
  hooks: ReactHooksLike;
  runEffect(): (() => void) | void;
  getRef<T>(): { current: T };
} {
  let capturedEffect: (() => void | (() => void)) | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let capturedRef: { current: any } = { current: null };

  const hooks: ReactHooksLike = {
    useEffect(effect, _deps) {
      capturedEffect = effect;
    },
    useRef<T>(init: T) {
      capturedRef = { current: init };
      return capturedRef as ReturnType<ReactHooksLike['useRef']>;
    },
  } as unknown as ReactHooksLike;

  return {
    hooks,
    runEffect() {
      if (!capturedEffect) throw new Error('useEffect was never called');
      return capturedEffect();
    },
    getRef<T>() {
      return capturedRef as { current: T };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createReactPraescio — factory', () => {
  it('returns a function (the usePraescio hook)', () => {
    const { hooks } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);
    expect(typeof usePraescio).toBe('function');
  });

  it('calling the hook invokes useEffect once', () => {
    const useEffectSpy = vi.fn();
    const hooks: ReactHooksLike = {
      useEffect: useEffectSpy,
      useRef: <T>(init: T) => ({ current: init }),
    } as unknown as ReactHooksLike;

    const usePraescio = createReactPraescio(hooks);
    const input = makeInput();
    const inputRef: ReactReadonlyRef<HTMLInputElement> = { current: input };

    usePraescio(inputRef, { source: ['Apple'] });

    expect(useEffectSpy).toHaveBeenCalledOnce();
    input.remove();
  });

  it('calling the hook invokes useRef once (for the instance ref)', () => {
    const useRefSpy = vi.fn().mockReturnValue({ current: null });
    const hooks: ReactHooksLike = {
      useEffect: vi.fn(),
      useRef: useRefSpy,
    } as unknown as ReactHooksLike;

    const usePraescio = createReactPraescio(hooks);
    const input = makeInput();
    usePraescio({ current: input }, { source: ['Apple'] });

    expect(useRefSpy).toHaveBeenCalledOnce();
    input.remove();
  });
});

describe('createReactPraescio — effect lifecycle', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = makeInput();
  });

  afterEach(() => {
    input.remove();
  });

  it('effect mounts Praescio and adds the panel to the DOM', () => {
    const { hooks, runEffect } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);
    const panelsBefore = document.querySelectorAll('.praescio__panel').length;

    usePraescio({ current: input }, { source: ['Apple', 'Banana'] });
    runEffect();

    expect(document.querySelectorAll('.praescio__panel').length).toBeGreaterThan(panelsBefore);
  });

  it('cleanup function from the effect destroys the instance and removes panel', () => {
    const { hooks, runEffect } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);

    usePraescio({ current: input }, { source: ['Apple'] });
    const cleanup = runEffect() as () => void;

    // Use querySelectorAll + last index to get the panel added by this test,
    // avoiding stale panels left in the DOM by preceding tests.
    const all = document.querySelectorAll('.praescio__panel');
    const panel = all[all.length - 1];
    expect(panel).toBeTruthy();

    cleanup();
    expect(document.body.contains(panel)).toBe(false);
  });

  it('effect sets instanceRef.current to the Praescio instance', () => {
    const { hooks, runEffect, getRef } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);

    usePraescio({ current: input }, { source: ['Apple'] });
    runEffect();

    const instanceRef = getRef<{ destroy: () => void } | null>();
    expect(instanceRef.current).not.toBeNull();
    expect(typeof instanceRef.current?.destroy).toBe('function');

    // Cleanup
    instanceRef.current?.destroy();
  });

  it('cleanup nulls instanceRef.current', () => {
    const { hooks, runEffect, getRef } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);

    usePraescio({ current: input }, { source: ['Apple'] });
    const cleanup = runEffect() as () => void;
    cleanup();

    const instanceRef = getRef<unknown>();
    expect(instanceRef.current).toBeNull();
  });

  it('effect is a no-op when inputRef.current is null', () => {
    const { hooks, runEffect } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);

    usePraescio({ current: null }, { source: ['Apple'] });
    expect(() => runEffect()).not.toThrow();
  });

  it('no-op effect returns undefined (no cleanup to call)', () => {
    const { hooks, runEffect } = makeReactMock();
    const usePraescio = createReactPraescio(hooks);

    usePraescio({ current: null }, { source: ['Apple'] });
    const result = runEffect();
    expect(result).toBeUndefined();
  });
});
