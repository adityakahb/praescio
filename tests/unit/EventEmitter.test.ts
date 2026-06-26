import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../src/core/EventEmitter';

describe('EventEmitter', () => {
  it('calls a registered handler when the event is emitted', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('open', handler);
    emitter.emit('open');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes arguments to the handler', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('select', handler);
    emitter.emit('select', { label: 'Paris' }, new MouseEvent('click'));
    expect(handler).toHaveBeenCalledWith({ label: 'Paris' }, expect.any(MouseEvent));
  });

  it('calls multiple handlers for the same event', () => {
    const emitter = new EventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('open', h1);
    emitter.on('open', h2);
    emitter.emit('open');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not call handlers for a different event', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('open', handler);
    emitter.emit('close');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emitting an event with no listeners is a no-op', () => {
    const emitter = new EventEmitter();
    expect(() => emitter.emit('unknown')).not.toThrow();
  });

  it('on() returns an unsubscribe function that removes the handler', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    const off = emitter.on('open', handler);
    off();
    emitter.emit('open');
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() removes a specific handler', () => {
    const emitter = new EventEmitter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('open', h1);
    emitter.on('open', h2);
    emitter.off('open', h1);
    emitter.emit('open');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('off() for an unknown event is a no-op', () => {
    const emitter = new EventEmitter();
    expect(() => emitter.off('unknown', vi.fn())).not.toThrow();
  });

  it('deduplicated registration — same function registered twice fires once', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('open', handler);
    emitter.on('open', handler); // duplicate
    emitter.emit('open');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('destroy() removes all listeners', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('open', handler);
    emitter.on('close', handler);
    emitter.destroy();
    emitter.emit('open');
    emitter.emit('close');
    expect(handler).not.toHaveBeenCalled();
  });
});
