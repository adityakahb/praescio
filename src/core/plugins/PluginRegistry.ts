import type { PraescioPlugin, PraescioPublicAPI } from '../../types/Plugin';
import type { PraescioOptions } from '../../types/PraescioOptions';

/**
 * Installs and tracks all plugins registered for a Praescio instance.
 *
 * Each plugin's `install` method is called exactly once; if a plugin throws
 * during installation the error is logged to the console and the remaining
 * plugins continue to install normally.
 */
export class PluginRegistry {
  private plugins: PraescioPlugin[] = [];

  /**
   * Install every plugin in `plugins`, passing the live instance and its
   * resolved options. Errors are caught per-plugin so a bad plugin cannot
   * prevent other plugins from loading.
   *
   * The method is generic so callers can pass a `ResolvedOptions<T>` for any
   * concrete `T` without a contravariance error on `transform`.
   */
  installAll<T>(
    plugins: PraescioPlugin[],
    instance: PraescioPublicAPI,
    options: Readonly<PraescioOptions<T>>
  ): void {
    for (const plugin of plugins) {
      try {
        plugin.install(instance, options);
        this.plugins.push(plugin);
      } catch (err) {
        // eslint-disable-next-line no-console -- intentional: surface plugin install failures to the developer
        console.error(`Praescio: plugin "${plugin.name}" failed to install`, err);
      }
    }
  }
}
