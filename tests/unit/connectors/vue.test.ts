import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVuePraescio } from '../../../src/connectors/vue';
import type { VueLike } from '../../../src/connectors/vue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(): HTMLInputElement {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return el;
}

/**
 * Build a minimal VueLike mock that captures lifecycle callbacks so tests
 * can invoke them synchronously, simulating component mount/unmount.
 */
function makeVueMock(): {
  vue: VueLike;
  triggerMounted(): void;
  triggerBeforeUnmount(): void;
} {
  let mountedFn: (() => void) | null = null;
  let beforeUnmountFn: (() => void) | null = null;

  const vue: VueLike = {
    ref: <T>(value: T) => ({ value }),
    onMounted: (fn) => {
      mountedFn = fn;
    },
    onBeforeUnmount: (fn) => {
      beforeUnmountFn = fn;
    },
  };

  return {
    vue,
    triggerMounted() {
      if (!mountedFn) throw new Error('onMounted callback was never registered');
      mountedFn();
    },
    triggerBeforeUnmount() {
      if (!beforeUnmountFn) throw new Error('onBeforeUnmount callback was never registered');
      beforeUnmountFn();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createVuePraescio — factory', () => {
  it('returns a function (the usePraescio composable)', () => {
    const { vue } = makeVueMock();
    const usePraescio = createVuePraescio(vue);
    expect(typeof usePraescio).toBe('function');
  });

  it('calling the composable registers onMounted and onBeforeUnmount', () => {
    const onMountedSpy = vi.fn();
    const onBeforeUnmountSpy = vi.fn();
    const vue: VueLike = {
      ref: <T>(v: T) => ({ value: v }),
      onMounted: onMountedSpy,
      onBeforeUnmount: onBeforeUnmountSpy,
    };

    const usePraescio = createVuePraescio(vue);
    const input = makeInput();
    usePraescio({ value: input }, { source: ['Apple'] });

    expect(onMountedSpy).toHaveBeenCalledOnce();
    expect(onBeforeUnmountSpy).toHaveBeenCalledOnce();
    input.remove();
  });

  it('returns a reactive ref initialised to null', () => {
    const { vue } = makeVueMock();
    const usePraescio = createVuePraescio(vue);
    const input = makeInput();

    const instanceRef = usePraescio({ value: input }, { source: ['Apple'] });
    expect(instanceRef.value).toBeNull();

    input.remove();
  });
});

describe('createVuePraescio — onMounted lifecycle', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = makeInput();
  });

  afterEach(() => {
    input.remove();
  });

  it('onMounted creates the Praescio instance and sets instanceRef', () => {
    const { vue, triggerMounted } = makeVueMock();
    const usePraescio = createVuePraescio(vue);

    const instanceRef = usePraescio({ value: input }, { source: ['Apple'] });
    expect(instanceRef.value).toBeNull();

    triggerMounted();
    expect(instanceRef.value).not.toBeNull();
  });

  it('onMounted appends the panel to the DOM', () => {
    const { vue, triggerMounted } = makeVueMock();
    const usePraescio = createVuePraescio(vue);
    const panelsBefore = document.querySelectorAll('.praescio__panel').length;

    usePraescio({ value: input }, { source: ['Apple', 'Banana'] });
    triggerMounted();

    expect(document.querySelectorAll('.praescio__panel').length).toBeGreaterThan(panelsBefore);
  });

  it('onMounted is a no-op when inputRef.value is null', () => {
    const { vue, triggerMounted } = makeVueMock();
    const usePraescio = createVuePraescio(vue);

    usePraescio({ value: null }, { source: ['Apple'] });
    expect(() => triggerMounted()).not.toThrow();
  });
});

describe('createVuePraescio — onBeforeUnmount lifecycle', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = makeInput();
  });

  afterEach(() => {
    input.remove();
  });

  it('onBeforeUnmount destroys the instance and nulls the ref', () => {
    const { vue, triggerMounted, triggerBeforeUnmount } = makeVueMock();
    const usePraescio = createVuePraescio(vue);

    const instanceRef = usePraescio({ value: input }, { source: ['Apple'] });
    triggerMounted();
    expect(instanceRef.value).not.toBeNull();

    triggerBeforeUnmount();
    expect(instanceRef.value).toBeNull();
  });

  it('onBeforeUnmount removes the panel from the DOM', () => {
    const { vue, triggerMounted, triggerBeforeUnmount } = makeVueMock();
    const usePraescio = createVuePraescio(vue);

    usePraescio({ value: input }, { source: ['Apple'] });
    triggerMounted();

    // Use querySelectorAll + last index to get the panel added by this test,
    // avoiding stale panels left in the DOM by preceding tests.
    const all = document.querySelectorAll('.praescio__panel');
    const panel = all[all.length - 1];
    expect(panel).toBeTruthy();

    triggerBeforeUnmount();
    expect(document.body.contains(panel)).toBe(false);
  });

  it('onBeforeUnmount is safe to call when instance is null (never mounted)', () => {
    const { vue, triggerBeforeUnmount } = makeVueMock();
    const usePraescio = createVuePraescio(vue);

    usePraescio({ value: input }, { source: ['Apple'] });
    expect(() => triggerBeforeUnmount()).not.toThrow();
  });
});
