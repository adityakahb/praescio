import { defineConfig, type Plugin, type RollupOptions } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

const input = 'src/index.ts';

/**
 * Rollup plugin that remaps the Praescio core import to the bare package
 * specifier `'praescio'` before TypeScript resolves it to an absolute path.
 *
 * By intercepting the raw import string `'../core/Praescio'` in resolveId and
 * returning `{ id: 'praescio', external: true }`, we ensure the generated
 * output contains `import { Praescio } from 'praescio'` (a valid bare
 * specifier that consumer bundlers resolve via package.json exports) rather
 * than a computed relative path.
 *
 * This prevents code duplication when a consumer imports from both 'praescio'
 * and 'praescio/connectors' — their bundler loads the core once and
 * deduplicates automatically.
 */
const externalCorePlugin = (): Plugin => ({
  name: 'praescio-external-core',
  resolveId(id: string) {
    if (id === '../core/Praescio') {
      return { id: 'praescio', external: true };
    }
    return null;
  },
});

/**
 * Factory for the TypeScript plugin.
 *
 * @param declarationDir - When provided, TypeScript declaration files (.d.ts)
 *   are emitted alongside the build output into this directory. Only the ESM
 *   builds pass a value here so that a single set of declarations is produced.
 *   All other builds omit this argument so that no duplicate declarations are
 *   written to disk.
 *
 * @param sourcemap - When `true`, TypeScript emits source map data that Rollup
 *   collects into external `.map` files. `inlineSources` is also enabled so
 *   the original TypeScript source content is embedded in the map — this makes
 *   source maps fully self-contained and usable even when the consumer does not
 *   have the `src/` directory (e.g. after `npm install`).
 *
 *   Only unminified builds receive source maps; minified builds omit them to
 *   keep CDN / production bundles small.
 */
const tsPlugin = (declarationDir?: string, sourcemap = false) =>
  typescript({
    tsconfig: './tsconfig.build.json',
    declaration: !!declarationDir,
    declarationMap: false,
    declarationDir: declarationDir ?? undefined,
    sourceMap: sourcemap,
    inlineSources: sourcemap,
    exclude: ['tests/**'],
  });

const configs: RollupOptions[] = [
  /**
   * ESM build — dist/scripts/praescio.esm.js + praescio.esm.js.map
   *
   * Tree-shakeable ES module intended for modern bundlers (webpack, Vite, esbuild,
   * Rollup). TypeScript declarations are emitted into dist/scripts/ alongside
   * this artefact so the next build step can bundle them into a single .d.ts.
   * An external source map is written alongside the bundle for debuggability.
   *
   * treeshake.moduleSideEffects: false tells Rollup that none of the source
   * modules have import-time side effects, enabling the most aggressive dead-code
   * elimination during the build. This is safe because Praescio has no
   * auto-initialising code at module evaluation time.
   */
  {
    input,
    treeshake: { moduleSideEffects: false },
    output: {
      file: 'dist/scripts/praescio.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [tsPlugin('dist/scripts', true)],
  },

  /**
   * ESM minified — dist/scripts/praescio.esm.min.js
   *
   * Minified ES module for size-sensitive deployments that still need ESM
   * semantics (e.g. native browser ESM imports without a bundler).
   */
  {
    input,
    output: {
      file: 'dist/scripts/praescio.esm.min.js',
      format: 'esm',
    },
    plugins: [tsPlugin(), terser()],
  },

  /**
   * CJS build — dist/scripts/praescio.cjs.js + praescio.cjs.js.map
   *
   * CommonJS module for Node.js environments and older bundlers that do not
   * support ESM. Named exports are preserved so that destructured imports
   * continue to work. An external source map is included for debuggability.
   */
  {
    input,
    output: {
      file: 'dist/scripts/praescio.cjs.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [tsPlugin(undefined, true)],
  },

  /**
   * CJS minified — dist/scripts/praescio.cjs.min.js
   *
   * Minified CommonJS build for Node.js distributions where bundle size
   * matters (e.g. Lambda functions, embedded server-side rendering).
   */
  {
    input,
    output: {
      file: 'dist/scripts/praescio.cjs.min.js',
      format: 'cjs',
      exports: 'named',
    },
    plugins: [tsPlugin(), terser()],
  },

  /**
   * UMD build — dist/scripts/praescio.umd.js + praescio.umd.js.map
   *
   * Universal Module Definition that works as AMD, CommonJS, or a browser
   * global. Suitable for environments that require a single file compatible
   * with all three module systems. An external source map is included.
   */
  {
    input,
    output: {
      file: 'dist/scripts/praescio.umd.js',
      format: 'umd',
      name: 'Praescio',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [tsPlugin(undefined, true)],
  },

  /**
   * UMD minified — dist/scripts/praescio.umd.min.js
   *
   * Minified UMD build for production use in environments that rely on the
   * UMD format (e.g. older CMS integrations, legacy AMD loaders).
   */
  {
    input,
    output: {
      file: 'dist/scripts/praescio.umd.min.js',
      format: 'umd',
      name: 'Praescio',
      exports: 'named',
    },
    plugins: [tsPlugin(), terser()],
  },

  /**
   * CDN / IIFE minified — dist/scripts/praescio.min.js
   *
   * Self-contained, minified IIFE that exposes the library as a global
   * `window.Praescio`. Drop it into any HTML page via a <script> tag without
   * any module bundler. This is the artefact linked from CDN hosts such as
   * jsDelivr or unpkg.
   */
  {
    input,
    output: {
      file: 'dist/scripts/praescio.min.js',
      format: 'iife',
      name: 'Praescio',
      exports: 'named',
    },
    plugins: [tsPlugin(), terser()],
  },

  /**
   * TypeScript declarations bundle — dist/praescio.d.ts
   *
   * Rolls up all individual .d.ts files emitted by the ESM build step into a
   * single, self-contained declaration file at the package root of dist/.
   * This is the file pointed to by the "types" field in package.json and
   * consumed by TypeScript consumers of the published package.
   *
   * Input: dist/scripts/index.d.ts  (produced by the ESM build above)
   * Output: dist/praescio.d.ts
   */
  {
    input: 'dist/scripts/index.d.ts',
    output: {
      file: 'dist/praescio.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },

  // ---------------------------------------------------------------------------
  // Framework connectors
  // ---------------------------------------------------------------------------

  /**
   * Connectors ESM — dist/scripts/praescio-connectors.esm.js + .map
   *
   * Tree-shakeable ES module containing the React hook factory, Vue composable
   * factory, Angular directive base class, and Svelte action. Consumers import
   * from 'praescio/connectors'.
   *
   * externalCorePlugin intercepts '../core/Praescio' before TypeScript resolves
   * it, returning { id: 'praescio', external: true }. This produces
   * `import { Praescio } from 'praescio'` in the output — a valid bare
   * specifier that consumer bundlers resolve via the package.json 'exports'
   * field. Consumers who import from both 'praescio' and 'praescio/connectors'
   * therefore bundle the core only once (no duplication).
   *
   * An external source map is written alongside the bundle for debuggability.
   */
  {
    input: 'src/connectors/index.ts',
    treeshake: { moduleSideEffects: false },
    output: {
      file: 'dist/scripts/praescio-connectors.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [externalCorePlugin(), tsPlugin('dist/scripts/connectors', true)],
  },

  /**
   * Connectors ESM minified — dist/scripts/praescio-connectors.esm.min.js
   *
   * Minified version of the connectors ESM bundle for production deployments.
   * The core is external for the same deduplication reason.
   */
  {
    input: 'src/connectors/index.ts',
    output: {
      file: 'dist/scripts/praescio-connectors.esm.min.js',
      format: 'esm',
    },
    plugins: [externalCorePlugin(), tsPlugin(), terser()],
  },

  /**
   * Connectors TypeScript declarations — dist/praescio-connectors.d.ts
   *
   * Bundles all connector .d.ts files into a single declaration file at
   * dist/praescio-connectors.d.ts. This is the file referenced by the
   * "types" field of the './connectors' export in package.json.
   *
   * Input: dist/scripts/connectors/index.d.ts
   * Output: dist/praescio-connectors.d.ts
   */
  {
    input: 'dist/scripts/connectors/index.d.ts',
    output: {
      file: 'dist/praescio-connectors.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
];

export default defineConfig(configs);
