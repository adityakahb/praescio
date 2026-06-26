import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../../src/core/plugins/PluginRegistry';
import type { PraescioPlugin, PraescioPublicAPI } from '../../src/types/Plugin';
import type { PraescioOptions } from '../../src/types/PraescioOptions';

const INSTANCE = {} as PraescioPublicAPI;
const OPTIONS = {} as Readonly<PraescioOptions>;

function makePlugin(name: string, install = vi.fn()): PraescioPlugin {
  return { name, install };
}

// ── installAll ────────────────────────────────────────────────────────────────

describe('PluginRegistry — installAll', () => {
  it('calls install on each plugin', () => {
    const a = makePlugin('a');
    const b = makePlugin('b');
    new PluginRegistry().installAll([a, b], INSTANCE, OPTIONS);
    expect(a.install).toHaveBeenCalledOnce();
    expect(b.install).toHaveBeenCalledOnce();
  });

  it('passes the instance and options to each install call', () => {
    const plugin = makePlugin('p');
    new PluginRegistry().installAll([plugin], INSTANCE, OPTIONS);
    expect(plugin.install).toHaveBeenCalledWith(INSTANCE, OPTIONS);
  });

  it('continues installing remaining plugins when one throws', () => {
    const bad = makePlugin(
      'bad',
      vi.fn().mockImplementation(() => {
        throw new Error('fail');
      })
    );
    const good = makePlugin('good');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new PluginRegistry().installAll([bad, good], INSTANCE, OPTIONS);
    expect(good.install).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it('logs an error with the plugin name when install throws', () => {
    const bad = makePlugin(
      'broken',
      vi.fn().mockImplementation(() => {
        throw new Error('oops');
      })
    );
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new PluginRegistry().installAll([bad], INSTANCE, OPTIONS);
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect((consoleSpy.mock.calls[0] as string[])[0]).toContain('broken');
    consoleSpy.mockRestore();
  });

  it('is a no-op for an empty plugin list', () => {
    expect(() => new PluginRegistry().installAll([], INSTANCE, OPTIONS)).not.toThrow();
  });
});
