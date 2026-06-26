import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputController } from '../../src/core/input/InputController';
import { StateManager } from '../../src/core/state/StateManager';
import type { CommonOptions } from '../../src/types/PraescioOptions';

// Minimal options — only the fields InputController reads
const baseOptions = {
  debounce: 0,
  minChars: 1,
  openOnFocus: false,
} as unknown as CommonOptions;

function makeInput(): HTMLInputElement {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return el;
}

function fireInput(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('InputController — getValue / setValue', () => {
  it('getValue returns the raw input value', () => {
    const el = makeInput();
    el.value = '  hello  ';
    const ctrl = new InputController(el, new StateManager(), baseOptions, vi.fn());
    expect(ctrl.getValue()).toBe('  hello  ');
    ctrl.destroy();
    el.remove();
  });

  it('setValue updates the input value', () => {
    const el = makeInput();
    const ctrl = new InputController(el, new StateManager(), baseOptions, vi.fn());
    ctrl.setValue('world');
    expect(el.value).toBe('world');
    ctrl.destroy();
    el.remove();
  });
});

describe('InputController — query trimming on input', () => {
  let input: HTMLInputElement;
  let stateManager: StateManager;
  let onQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    input = makeInput();
    stateManager = new StateManager();
    onQuery = vi.fn();
  });

  afterEach(() => {
    input.remove();
  });

  it('dispatches CLOSE for whitespace-only input (3 spaces)', () => {
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    new InputController(input, stateManager, baseOptions, onQuery);

    input.value = '   ';
    fireInput(input);

    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'QUERY_CHANGED', query: '' });
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'CLOSE' });
    expect(onQuery).not.toHaveBeenCalled();
  });

  it('dispatches CLOSE for tab-only input', () => {
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    new InputController(input, stateManager, baseOptions, onQuery);

    input.value = '\t\t';
    fireInput(input);

    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'CLOSE' });
  });

  it('dispatches QUERY_CHANGED with the trimmed value', () => {
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    new InputController(input, stateManager, baseOptions, onQuery);

    input.value = '  apple  ';
    fireInput(input);

    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'QUERY_CHANGED', query: 'apple' });
  });

  it('does not open the panel when trimmed length is below minChars', () => {
    const opts = { ...baseOptions, minChars: 3 } as unknown as CommonOptions;
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    new InputController(input, stateManager, opts, onQuery);

    input.value = 'ab';
    fireInput(input);

    const closeCalls = dispatchSpy.mock.calls.filter((c) => c[0]?.type === 'CLOSE');
    expect(closeCalls).toHaveLength(0);
  });
});

describe('InputController — minChars threshold', () => {
  it('respects minChars=3 with whitespace-padded input', () => {
    const input = makeInput();
    const stateManager = new StateManager();
    const onQuery = vi.fn();
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    const opts = { ...baseOptions, minChars: 3 } as unknown as CommonOptions;

    new InputController(input, stateManager, opts, onQuery);

    // "   " → trimmed = "" → length 0 → CLOSE
    input.value = '   ';
    fireInput(input);
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'CLOSE' });

    input.remove();
  });
});

describe('InputController — focus (openOnFocus)', () => {
  it('re-opens panel on focus when openOnFocus=true and cached items exist', () => {
    const input = makeInput();
    const stateManager = new StateManager();
    const opts = { ...baseOptions, openOnFocus: true } as unknown as CommonOptions;
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');

    // Seed state with a query and cached items
    stateManager.dispatch({ type: 'QUERY_CHANGED', query: 'apple' });
    // @ts-expect-error — inject items directly for testing
    stateManager['state'] = {
      ...stateManager.getState(),
      items: [{ type: 'text', label: 'Apple' }],
      query: 'apple',
    };

    new InputController(input, stateManager, opts, vi.fn());
    input.value = 'apple';
    input.dispatchEvent(new FocusEvent('focus'));

    const openCalls = dispatchSpy.mock.calls.filter((c) => c[0]?.type === 'OPEN_CACHED');
    expect(openCalls).toHaveLength(1);

    input.remove();
  });

  it('does not re-open when openOnFocus=false', () => {
    const input = makeInput();
    const stateManager = new StateManager();
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    // @ts-expect-error — accessing private field to seed state for test
    stateManager['state'] = {
      ...stateManager.getState(),
      items: [{ type: 'text', label: 'Apple' }],
      query: 'apple',
    };

    new InputController(input, stateManager, baseOptions, vi.fn());
    input.value = 'apple';
    input.dispatchEvent(new FocusEvent('focus'));

    const openCalls = dispatchSpy.mock.calls.filter((c) => c[0]?.type === 'OPEN_CACHED');
    expect(openCalls).toHaveLength(0);

    input.remove();
  });
});

describe('InputController — destroy', () => {
  it('removes event listeners so input events are ignored after destroy', () => {
    const input = makeInput();
    const stateManager = new StateManager();
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');
    const ctrl = new InputController(input, stateManager, baseOptions, vi.fn());

    ctrl.destroy();
    dispatchSpy.mockClear();

    input.value = 'hello';
    fireInput(input);
    expect(dispatchSpy).not.toHaveBeenCalled();

    input.remove();
  });
});
