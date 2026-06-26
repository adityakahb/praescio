/**
 * @fileoverview ESLint v9+ flat configuration for the Praescio autocomplete library.
 *
 * Uses the unified `typescript-eslint` v8 package which provides first-class
 * ESLint v9 / flat-config support. Combines recommended JS rules with
 * TypeScript-aware linting, scoped to all TypeScript source and test files.
 *
 * @see https://typescript-eslint.io/packages/typescript-eslint
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  /** Globally ignored paths — these are never linted. */
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },

  /** Baseline recommended JS rules */
  js.configs.recommended,

  /** TypeScript-aware rules for all .ts source and test files */
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    rules: {
      /** Turn off base rule — TS version handles it correctly with type info */
      'no-unused-vars': 'off',

      /**
       * Error on unused variables; allow leading underscore convention (_name)
       * to mark intentionally unused parameters (e.g. interface implementations).
       */
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      /** Warn on `any` — prefer `unknown` or proper types */
      '@typescript-eslint/no-explicit-any': 'warn',

      /** Discourage console.log in library code — use event emitters instead */
      'no-console': 'warn',
    },
  },
);
