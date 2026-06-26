/**
 * @fileoverview PostCSS configuration for Praescio stylesheet bundling.
 *
 * Handles @import inlining, vendor prefixing, and optional minification.
 * Minification is applied when NODE_ENV=production (the build:css script's
 * second pass produces praescio.min.css this way).
 *
 * Plugins:
 *   postcss-import  — Inline @import rules into a single bundled CSS file.
 *   autoprefixer    — Add vendor prefixes per browserslist targets.
 *   cssnano         — Minify in production: collapse whitespace, merge rules.
 *
 * @see https://postcss.org/
 */

'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */
const postcssImport = require('postcss-import');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

/**
 * @param {import('postcss-load-config').ConfigContext} ctx
 * @returns {import('postcss-load-config').Config}
 */
module.exports = (ctx) => ({
  plugins: [
    postcssImport(),
    autoprefixer(),
    ctx.env === 'production'
      ? cssnano({ preset: ['default', { discardComments: { removeAll: false } }] })
      : false,
  ].filter(Boolean),
});
