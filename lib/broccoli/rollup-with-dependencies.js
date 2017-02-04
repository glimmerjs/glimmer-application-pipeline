"use strict";

const Rollup = require('broccoli-rollup');
const nodeResolve = require('rollup-plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const sourcemaps = require('rollup-plugin-sourcemaps');

const fs = require('fs');
const path = require('path');

RollupWithDependencies.prototype = Object.create(Rollup.prototype);
RollupWithDependencies.prototype.constructor = RollupWithDependencies;

function RollupWithDependencies(inputNode, options) {
  if (!(this instanceof RollupWithDependencies)) {
    return new RollupWithDependencies(inputNode, options);
  }

  Rollup.call(this, inputNode, options);
}

RollupWithDependencies.prototype.build = function() {
  let plugins = this.rollupOptions.plugins || [];
  let inputPath = this.inputPaths[0];

  plugins.push(sourcemaps());

  plugins.push(babel({
    presets: [
      [
        'es2015',
        { modules: false }
      ]
    ],
    plugins: [
      'external-helpers'
    ],
    // TODO sourceMaps: 'inline',
    retainLines: true
  }));

  plugins.push({
    resolveId(importee, importer) {
      let modulePath = path.join(inputPath, importee, 'index.js');

      if (fs.existsSync(modulePath)) {
        return modulePath;
      }

      modulePath = path.join(inputPath, importee + '.js');
      if (fs.existsSync(modulePath)) {
        return modulePath;
      }
    }
  });

  plugins.push(nodeResolve({
    jsnext: true,
    main: true
  }));

  this.rollupOptions.plugins = plugins;

  return Rollup.prototype.build.apply(this, arguments);
};

module.exports = RollupWithDependencies;
