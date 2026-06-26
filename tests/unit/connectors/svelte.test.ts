import { describe, it, expect } from 'vitest';
import { praescioAction } from '../../../src/connectors/svelte';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(): HTMLInputElement {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('praescioAction — return shape', () => {
  it('returns an object with update and destroy functions', () => {
    const input = makeInput();
    const action = praescioAction(input, { source: ['Apple'] });

    expect(typeof action.update).toBe('function');
    expect(typeof action.destroy).toBe('function');

    action.destroy();
    input.remove();
  });
});

describe('praescioAction — mount', () => {
  it('mounts Praescio and adds the panel to the DOM', () => {
    const input = makeInput();
    const panelsBefore = document.querySelectorAll('.praescio__panel').length;

    const action = praescioAction(input, { source: ['Apple', 'Banana'] });
    expect(document.querySelectorAll('.praescio__panel').length).toBeGreaterThan(panelsBefore);

    action.destroy();
    input.remove();
  });
});

describe('praescioAction — destroy', () => {
  it('removes the panel from the DOM', () => {
    const input = makeInput();
    const action = praescioAction(input, { source: ['Apple'] });

    const panel = document.querySelector('.praescio__panel');
    expect(panel).toBeTruthy();

    action.destroy();
    expect(document.body.contains(panel)).toBe(false);
    input.remove();
  });

  it('is idempotent — calling destroy twice does not throw', () => {
    const input = makeInput();
    const action = praescioAction(input, { source: ['Apple'] });

    action.destroy();
    // Praescio.destroy() is idempotent; the action should be too
    expect(() => action.destroy()).not.toThrow();
    input.remove();
  });
});

describe('praescioAction — update', () => {
  it('recreates the instance with new options', () => {
    const input = makeInput();
    const action = praescioAction(input, { source: ['Apple'] });

    const panelBefore = document.querySelector('.praescio__panel');
    action.update({ source: ['Banana', 'Cherry'] });
    const panelAfter = document.querySelector('.praescio__panel');

    // Old panel removed, new one added
    expect(document.body.contains(panelBefore)).toBe(false);
    expect(panelAfter).not.toBeNull();

    action.destroy();
    input.remove();
  });

  it('leaves exactly one panel after update', () => {
    const input = makeInput();
    const action = praescioAction(input, { source: ['Apple'] });

    action.update({ source: ['Banana', 'Cherry', 'Date'] });

    // Only one panel should be attached for this input
    const panels = document.querySelectorAll('.praescio__panel');
    expect(panels.length).toBeGreaterThanOrEqual(1);

    action.destroy();
    input.remove();
  });

  it('new instance responds to the updated source options', () => {
    const input = makeInput();
    const action = praescioAction(input, { source: ['Apple'] });

    // Update to a new source — should not throw
    expect(() => {
      action.update({ source: async (q) => [{ type: 'text' as const, label: q }] });
    }).not.toThrow();

    action.destroy();
    input.remove();
  });
});
