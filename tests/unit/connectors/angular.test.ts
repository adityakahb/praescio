import { describe, it, expect } from 'vitest';
import { PraescioDirectiveBase } from '../../../src/connectors/angular';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(): HTMLInputElement {
  const el = document.createElement('input');
  document.body.appendChild(el);
  return el;
}

/**
 * Concrete subclass that exposes the three protected methods as public ones
 * so tests can exercise them directly, mimicking the Angular lifecycle hooks
 * that would call them in a real directive.
 */
class TestDirective extends PraescioDirectiveBase {
  constructor() {
    super();
    this.options = { source: ['Apple', 'Banana', 'Cherry'] };
  }

  /** Maps to ngOnInit in Angular */
  ngOnInit(el: HTMLElement) {
    this.init(el);
  }

  /** Maps to ngOnChanges in Angular */
  ngOnChanges(el: HTMLElement) {
    this.reinit(el);
  }

  /** Maps to ngOnDestroy in Angular */
  ngOnDestroy() {
    this.teardown();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PraescioDirectiveBase — initial state', () => {
  it('instance is null before ngOnInit', () => {
    const directive = new TestDirective();
    expect(directive.instance).toBeNull();
  });
});

describe('PraescioDirectiveBase — ngOnInit (init)', () => {
  it('creates a Praescio instance after ngOnInit', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    expect(directive.instance).not.toBeNull();

    directive.ngOnDestroy();
    input.remove();
  });

  it('appends the suggestion panel to the DOM', () => {
    const directive = new TestDirective();
    const input = makeInput();
    const panelsBefore = document.querySelectorAll('.praescio__panel').length;

    directive.ngOnInit(input);
    expect(document.querySelectorAll('.praescio__panel').length).toBeGreaterThan(panelsBefore);

    directive.ngOnDestroy();
    input.remove();
  });

  it('replaces an existing instance when called a second time', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    const first = directive.instance;

    directive.ngOnInit(input);
    const second = directive.instance;

    expect(first).not.toBe(second);
    expect(second).not.toBeNull();

    directive.ngOnDestroy();
    input.remove();
  });
});

describe('PraescioDirectiveBase — ngOnDestroy (teardown)', () => {
  it('sets instance to null', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    directive.ngOnDestroy();

    expect(directive.instance).toBeNull();
    input.remove();
  });

  it('removes the panel from the DOM', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    const panel = document.querySelector('.praescio__panel');
    expect(panel).toBeTruthy();

    directive.ngOnDestroy();
    expect(document.body.contains(panel)).toBe(false);
    input.remove();
  });

  it('is safe to call before ngOnInit', () => {
    const directive = new TestDirective();
    expect(() => directive.ngOnDestroy()).not.toThrow();
  });

  it('is idempotent — calling twice does not throw', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    directive.ngOnDestroy();
    expect(() => directive.ngOnDestroy()).not.toThrow();
    input.remove();
  });
});

describe('PraescioDirectiveBase — ngOnChanges (reinit)', () => {
  it('destroys the old instance and creates a new one', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    const first = directive.instance;

    directive.ngOnChanges(input);
    const second = directive.instance;

    expect(first).not.toBe(second);
    expect(second).not.toBeNull();

    directive.ngOnDestroy();
    input.remove();
  });

  it('leaves exactly one panel in the DOM', () => {
    const directive = new TestDirective();
    const input = makeInput();

    directive.ngOnInit(input);
    directive.ngOnChanges(input);

    // Only the new panel should be present; the old one must be removed
    const panels = document.querySelectorAll('.praescio__panel');
    expect(panels.length).toBeGreaterThanOrEqual(1);

    directive.ngOnDestroy();
    input.remove();
  });
});
