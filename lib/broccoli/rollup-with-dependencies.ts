const nodeResolve = require('rollup-plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const GlimmerInlinePrecompile = require('babel-plugin-glimmer-inline-precompile');
const fs = require('fs');
const BabelPresetEnv = require('babel-preset-env').default;
import { RollupOptions, GlimmerAppOptions } from '../interfaces';
import DebugMacros from 'babel-plugin-debug-macros';

interface RollupPlugin {
  name: string;
}

interface RollupError {
  code: string;
  message: string;
}

interface PackageJSON {
  name: string;
  main: string;
  module: string;
  'jsnext:main': string;
}

function hasPlugin(plugins: RollupPlugin[], name: string): boolean {
  return plugins.some(plugin => plugin.name === name);
}

import Rollup = require('broccoli-rollup');
import { Project } from 'ember-build-utilities';
import { Tree } from 'broccoli';

export { Rollup };

export interface RollupWithDependenciesOptions {
  inputFiles: string[];
  rollup?: RollupOptions;
  project: Project;
  buildConfig: GlimmerAppOptions;
}

class RollupWithDependencies extends Rollup {
  private project: Project;
  private buildConfig: GlimmerAppOptions;

  constructor(inputTree: Tree, options: RollupWithDependenciesOptions) {
    super(inputTree, options);

    this.project = options.project;
    this.buildConfig = options.buildConfig;
  }

  rollupOptions: any;
  inputPaths: any[];

  build(...args: any[]) {
    let plugins = this.rollupOptions.plugins || [];
    let sourceMapsEnabled = !!this.rollupOptions.sourceMap;
    let isProduction = process.env.EMBER_ENV === 'production';

    if (sourceMapsEnabled) {
      plugins.push(loadWithInlineMap());
    }

    if (!hasPlugin(plugins, 'babel')) {
      let buildConfig = this.buildConfig;

      let userProvidedBabelConfig = buildConfig.babel && buildConfig.babel || {};
      let userProvidedBabelPlugins = userProvidedBabelConfig.plugins || [];

      let babelPlugins = [
        'external-helpers',
        [GlimmerInlinePrecompile],
        [DebugMacros, {
          envFlags: {
            source: '@glimmer/env',
            flags: { DEBUG: !isProduction, PROD: isProduction, CI: !!process.env.CI }
          },

          debugTools: {
            source: '@glimmer/debug'
          }
        }],

        ...userProvidedBabelPlugins
      ];

      let presetEnvConfig = Object.assign({ loose: true }, userProvidedBabelConfig, {
        // ensure we do not carry forward `plugins`
        plugins: undefined,

        // do not transpile modules
        modules: false,

        targets: this.project.targets
      });

      plugins.push(babel({
        presets: [
          [BabelPresetEnv, presetEnvConfig]
        ],
        plugins: babelPlugins,
        sourceMaps: sourceMapsEnabled && 'inline',
        retainLines: false
      }));
    }

    if (!hasPlugin(plugins, 'resolve')) {
      plugins.push(nodeResolve({
        jsnext: true,
        module: true,
        modulesOnly: true,

        // this is a temporary work around to force all @glimmer/*
        // packages to use the `es2017` output (they are currently
        // using `es5` output)
        //
        // this should be removed once the various glimmerjs/glimmer-vm
        // packages have been updated to use the "Correct" module entry
        // point
        customResolveOptions:{
          packageFilter(pkg: PackageJSON, file: string) {
            if (pkg.name.startsWith('@glimmer/')) {
              pkg.main = 'dist/modules/es2017/index.js';
            } else if (pkg.module) {
              pkg.main = pkg.module;
            } else if (pkg['jsnext:main']) {
              pkg.main = pkg['jsnext:main'];
            }

            return pkg;
          }
        }
      }));
    }

    this.rollupOptions.plugins = plugins;

    this.rollupOptions.onwarn = function(warning: RollupError) {
      // Suppress known error message caused by TypeScript compiled code with Rollup
      // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
      if (warning.code === 'THIS_IS_UNDEFINED') {
        return;
      }
      console.log("Rollup warning: ", warning.message);
    };

    return Rollup.prototype.build.apply(this, args);
  }
}

let SOURCE_MAPPING_DATA_URL = '//# sourceMap';
SOURCE_MAPPING_DATA_URL += 'pingURL=data:application/json;base64,';

function loadWithInlineMap() {
  return {
    load: function (id: string) {
      if (id.indexOf('\0') > -1) { return; }

      var code = fs.readFileSync(id, 'utf8');
      var result = {
        code: code,
        map: null
      };
      var index = code.lastIndexOf(SOURCE_MAPPING_DATA_URL);
      if (index === -1) {
        return result;
      }
      result.code = code;
      result.map = parseSourceMap(code.slice(index + SOURCE_MAPPING_DATA_URL.length));
      return result;
    }
  };
}

function parseSourceMap(base64: string) {
  return JSON.parse(new Buffer(base64, 'base64').toString('utf8'));
}

export default RollupWithDependencies;
