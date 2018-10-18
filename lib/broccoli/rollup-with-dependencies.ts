import fs = require('fs');

import nodeResolve = require('rollup-plugin-node-resolve');
import babel = require('rollup-plugin-babel');

import GlimmerInlinePrecompile = require('babel-plugin-glimmer-inline-precompile');
import BabelPresetEnv from 'babel-preset-env';

import ExternalHelpersPlugin = require('babel-plugin-external-helpers');
import { RollupOptions, GlimmerAppOptions } from '../interfaces';
import DebugMacros from 'babel-plugin-debug-macros';

import Rollup = require('broccoli-rollup');
import { Project } from 'ember-build-utilities';
import { Tree } from 'broccoli';

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

export interface RollupWithDependenciesOptions {
  inputFiles: string[];
  rollup?: RollupOptions;
  project: Project;
  buildConfig: GlimmerAppOptions;
}

class RollupWithDependencies extends Rollup {
  private project: Project;
  private buildConfig: GlimmerAppOptions;
  private _inputNodes!: Tree[];
  protected nodeModulesPath!: string;

  constructor(inputTree: Tree, options: RollupWithDependenciesOptions) {
    super(inputTree, options);

    if (options.buildConfig.trees && options.buildConfig.trees.nodeModules) {
      this._inputNodes.push(options.buildConfig.trees.nodeModules);
    }

    this.project = options.project;
    this.buildConfig = options.buildConfig;
  }

  rollupOptions: any;

  build(...args: any[]) {
    let plugins = this.rollupOptions.plugins || [];
    let sourceMapsEnabled = !!this.rollupOptions.sourceMap;
    let isProduction = process.env.EMBER_ENV === 'production';

    if (this.inputPaths[1]) {
      this.nodeModulesPath = this.inputPaths[1];
    }

    if (sourceMapsEnabled) {
      plugins.push(loadWithInlineMap());
    }

    if (!hasPlugin(plugins, 'babel')) {
      let buildConfig = this.buildConfig;

      let userProvidedBabelConfig = buildConfig.babel && buildConfig.babel || {};
      let userProvidedBabelPlugins = userProvidedBabelConfig.plugins || [];

      let babelPlugins = [
        [ExternalHelpersPlugin],
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
      if (id.indexOf('\0') > -1) { return null; }

      let code = fs.readFileSync(id, 'utf8');
      let result = {
        code: code,
        map: null
      };

      let index = code.lastIndexOf(SOURCE_MAPPING_DATA_URL);
      if (index === -1) {
        return code;
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
