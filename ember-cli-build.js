"use strict";

const build = require('@glimmer/build');

module.exports = function() {
  return build({
    external: [
      'broccoli-config-loader',
      'broccoli-config-replace',
      'broccoli-funnel',
      'broccoli-concat',
      'path',
      'fs',
      'lodash.defaultsdeep',
      'broccoli-typescript-compiler',
      'exists-sync',
      'broccoli-merge-trees',
      'broccoli-sass',
      'broccoli-asset-rev',
      'broccoli-uglify-sourcemap',
      '@glimmer/resolution-map-builder',
      '@glimmer/resolver-configuration-builder',
      'broccoli-rollup',
      'rollup-plugin-node-resolve',
      'rollup-plugin-babel',
      'broccoli-persistent-filter',
      '@glimmer/compiler',
      'broccoli-source',
      'heimdalljs-logger',
      'broccoli-stew'
    ]
  });
}
