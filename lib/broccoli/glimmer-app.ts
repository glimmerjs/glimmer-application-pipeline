import defaultsDeep = require('lodash.defaultsDeep')

import * as ConfigLoader from 'broccoli-config-loader';
import * as ConfigReplace from 'broccoli-config-replace';

import Funnel = require('broccoli-funnel');
import fs = require('fs');
import path = require('path');
import { typescript } from 'broccoli-typescript-compiler';
import existsSync = require('exists-sync');
import concat = require('broccoli-concat');
import merge = require('broccoli-merge-trees');
import compileSass = require('broccoli-sass');
import replace = require('broccoli-string-replace');
import babel = require('broccoli-babel-transpiler');
import assetRev = require('broccoli-asset-rev');
import uglify = require('broccoli-uglify-sourcemap')
import ResolutionMapBuilder = require('@glimmer/resolution-map-builder');
import RollupWithDependencies from './rollup-with-dependencies';
import GlimmerTemplatePrecompiler from './glimmer-template-precompiler';

import { WatchedDir, UnwatchedDir } from 'broccoli-source';

import Logger = require('heimdalljs-logger');
const logger = Logger('@glimmer/application-pipeline:glimmer-app');

import stew = require('broccoli-stew');
const mv = stew.mv;
const find = stew.find;
const map = stew.map;

const DEFAULT_CONFIG = {
  outputPaths: {
    app: {
      html: 'index.html'
    }
  },
  configPath: './config/environment',
  trees: {
    app: 'src',
    styles: 'src/ui/styles'
  },
  jshintrc: {
    tests: 'tests',
    app: 'src'
  }
};

const DEFAULT_TS_OPTIONS = {
  tsconfig: {
    compilerOptions: {
      target: "es5",
      module: "es2015",
      inlineSourceMap: true,
      inlineSources: true,
      moduleResolution: "node"
    },
    exclude: [
      'node_modules',
      '**/*.d.ts'
    ]
  }
};

interface GlimmerAppOptions {
  outputPaths: any;
}

interface Project {
  root: string;
  name(): string;
  configPath(): string;

  pkg: {
    name: string;
  }
}

interface Trees {
  srcTree: Tree;
  nodeModulesTree: Tree;
}

interface Tree {

}

/**
 * GlimmerApp provides an interface to a package (app, engine, or addon)
 * compatible with the module unification layout.
 *
 * @class GlimmerApp
 * @extends EmberApp
 * @constructor
 * @param {Object} [defaults]
 * @param {Object} [options={}] Configuration options
 */
class GlimmerApp {
  public options: GlimmerAppOptions;
  public project: Project;
  public name: string;
  public env: 'production' | 'development';

  protected trees: Trees;
  protected srcPath: string;

  constructor(defaults, options) {
    if (arguments.length === 0) {
      options = {};
    } else if (arguments.length === 1) {
      options = defaults;
    } else {
      defaultsDeep(options, defaults);
    }

    options = this.options = defaultsDeep(options, DEFAULT_CONFIG);

    this.env = process.env.EMBER_ENV || 'development';
    this.project = options.project;
    this.name = options.name || this.project.name();
    this.trees = this.buildTrees();

    let srcPath = options.srcPath || 'src';
    this.srcPath = this.resolveLocal(srcPath);
  }

  _configReplacePatterns() {
    return [{
      match: /{{rootURL}}/g,
      replacement: () => '',
    }];
  }

  buildTrees(): Trees {
    const srcPath = this.resolveLocal('src');
    const srcTree = existsSync(srcPath) ? new WatchedDir(srcPath) : null;

    const nodeModulesPath = this.resolveLocal('node_modules');
    const nodeModulesTree = existsSync(srcPath) ? new UnwatchedDir(nodeModulesPath) : null;

    return {
      srcTree,
      nodeModulesTree
    }
  }

  private resolveLocal(to) {
    return path.join(this.project.root, to);
  }

  private tsOptions() {
    let tsconfigPath = this.resolveLocal('tsconfig.json');
    let tsconfig;

    if (existsSync(tsconfigPath)) {
      try {
        tsconfig = require(tsconfigPath);
      } catch (err) {
        console.log("Error reading from tsconfig.json");
      }
    } else {
      console.log("No tsconfig.json found; falling back to default TypeScript settings.");
    }

    return tsconfig ? { tsconfig } : DEFAULT_TS_OPTIONS;
  }

  /**
   * Creates a Broccoli tree representing the compiled Glimmer application.
   * 
   * @param options 
   */
  toTree(options) {
    let isProduction = process.env.EMBER_ENV === 'production';

    let jsTree = this.javascriptTree();
    let htmlTree = this.htmlTree();

    // Minify the JavaScript in production builds.
    if (isProduction) {
      jsTree = this.minifyTree(jsTree);
    }

    let appTree = merge([jsTree, htmlTree])

    // Fingerprint assets for cache busting in production.
    if (isProduction) {
      let extensions = ['js', 'css'];
      let replaceExtensions = ['html', 'js', 'css'];

      appTree = assetRev(appTree, {
        extensions,
        replaceExtensions
      });
    }

    return appTree;
  }

  javascriptTree() {
    let { srcTree, nodeModulesTree } = this.trees;

    // Grab the app's `src` directory.
    srcTree = find(srcTree, {
      destDir: 'src'
    });

    // Also grab node_modules, so TypeScript and Rollup can find dependencies
    // there.
    nodeModulesTree = find(nodeModulesTree, {
      destDir: 'node_modules'
    });

    // Compile the TypeScript and Handlebars files into JavaScript
    const compiledHandlebarsTree = this.compiledHandlebarsTree(srcTree);
    const compiledTypeScriptTree = this.compiledTypeScriptTree(srcTree, nodeModulesTree)

    // Remove top-most `src` directory so module names don't include it.
    const resolvableTree = find(merge([compiledTypeScriptTree, compiledHandlebarsTree]), {
      srcDir: 'src'
    });

    // Build the file that maps individual modules onto the resolver's specifier
    // keys.
    const moduleMap = this.buildResolutionMap(resolvableTree);

    // Merge the JavaScript source and generated module map together, making
    // sure to overwrite the stub module-map.js in the source tree with the
    // generated one.
    let jsTree = merge([
      resolvableTree,
      moduleMap
    ], { overwrite: true });

    // Finally, bundle the app into a single rolled up .js file.
    return this.rollupTree(jsTree);
  }

  compiledTypeScriptTree(srcTree, nodeModulesTree) {
    const tsOptions = this.tsOptions();
    const srcAndDependenciesTree = merge([srcTree, nodeModulesTree])

    return typescript(srcAndDependenciesTree, tsOptions);
  }

  compiledHandlebarsTree(srcTree) {
    let hbsTree = find(srcTree, {
      include: ['src/**/*.hbs']
    });

    return new GlimmerTemplatePrecompiler(hbsTree, {
      rootName: this.project.pkg.name
    });
  }

  rollupTree(jsTree) {
    return new RollupWithDependencies(jsTree, {
      inputFiles: ['**/*.js'],
      rollup: {
        onwarn(message) {
          // Suppress known error message caused by TypeScript compiled code with Rollup
          // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
          if (/The \`this\` keyword is equivalent to \`undefined\` at the top level of an ES module, and has been rewritten/.test(message)) {
            return;
          }
          console.log("Rollup warning: ", message);
        },
        format: 'es',
        entry: 'index.js',
        dest: 'app.js',
        sourceMap: 'inline'
      }
    });
  }

  minifyTree(jsTree) {
    return uglify(jsTree, {
      compress: {
        screw_ie8: true,
      },
      sourceMapConfig: {
        enabled: false
      }
    });
  }

  _configPath() {
    return path.join(this.name, 'config', 'environments', this.env + '.json');
  }

  rewriteConfigEnvironment(src) {
    return new ConfigReplace(src, this._configTree(), {
      configPath: this._configPath(),
      files: [ 'config/environment.js' ],
      patterns: this._configReplacePatterns()
    });
  }

  buildResolutionMap(src) {
    src = find(src, {
      exclude: ['config/**/*']
    });

    return new ResolutionMapBuilder(src, this._configTree(), {
      configPath: this._configPath()
      // configPath: 'src/config/environment.js'
      // configPath: `src/config/environments/${this.env}.js`
    });
  }

  htmlTree() {
    const htmlName = this.options.outputPaths.app.html;
    const files = [
      'index.html'
    ];

    const index = new Funnel('src/ui', {
      files,
      getDestinationPath(relativePath) {
        if (relativePath === 'index.html') {
          relativePath = htmlName;
        }
        return relativePath;
      },
      annotation: 'Funnel: index.html'
    });

    return new ConfigReplace(index, this._configTree(), {
      configPath: path.join(this.name, 'config', 'environments', this.env + '.json'),
      files: [ htmlName ],
      patterns: this._configReplacePatterns()
    });
  }

  _cachedConfigTree: any;

  _configTree() {
    if (this._cachedConfigTree) {
      return this._cachedConfigTree;
    }

    const configPath = this.project.configPath();
    const configTree = new ConfigLoader(path.dirname(configPath), {
      env: this.env,
      project: this.project
    });

    this._cachedConfigTree = new Funnel(configTree, {
      srcDir: '/',
      destDir: this.name + '/config',
      annotation: 'Funnel (config)'
    });

    return this._cachedConfigTree;
  }
}

export default GlimmerApp;