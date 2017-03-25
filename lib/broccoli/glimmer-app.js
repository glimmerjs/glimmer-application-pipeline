const defaultsDeep = require('lodash.defaultsDeep');
const ConfigLoader = require('broccoli-config-loader');
const ConfigReplace = require('broccoli-config-replace');
const { join, dirname } = require('path');
const Funnel = require('broccoli-funnel');
const { typescript } = require('broccoli-typescript-compiler');
const existsSync = require('exists-sync');
const concat = require('broccoli-concat');
const MergeTrees = require('broccoli-merge-trees');
const compileSass = require('broccoli-sass');
const StringReplace = require('broccoli-string-replace');
const Babel = require('broccoli-babel-transpiler');
const AssetRev = require('broccoli-asset-rev');
const Uglify = require('broccoli-uglify-sourcemap');
const ResolutionMapBuilder = require('@glimmer/resolution-map-builder');
const Rollup = require('broccoli-rollup');
const GlimmerTemplatePrecompiler = require('./glimmer-template-precompiler');
const babelPlugins = require('./babel-plugins');
const { WatchedDir, UnwatchedDir } = require('broccoli-source');
const Logger = require('heimdalljs-logger');
const { mv, find, map, debug } = require('broccoli-stew');
const nodeResolve = require('rollup-plugin-node-resolve');
const { moduleResolve: resolveModuleSource } = require('amd-name-resolver');
const Concat = require('broccoli-concat');
const funnelLib = require('./funnel-lib');

const logger = Logger('@glimmer/application-pipeline:glimmer-app');

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
/**
 * GlimmerApp provides an interface to a package (app, engine, or addon)
 * compatible with the module unification layout.
 *
 * @class GlimmerApp
 * @constructor
 * @param {Object} [defaults]
 * @param {Object} [options={}] Configuration options
 */
module.exports = class GlimmerApp {
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
    this._cachedConfigTree = null;
    this.babelHelpers = [];
  }

  _configReplacePatterns() {
    return [{
      match: /{{rootURL}}/g,
      replacement: () => '',
    }];
  }

  buildTrees() {
    const srcPath = this.resolveLocal('src');
    const srcTree = existsSync(srcPath) ? new WatchedDir(srcPath) : null;

    const nodeModulesPath = this.resolveLocal('node_modules');
    const nodeModulesTree = existsSync(srcPath) ? new UnwatchedDir(nodeModulesPath) : null;

    return {
      srcTree,
      nodeModulesTree
    }
  }

  resolveLocal(to) {
    return join(this.project.root, to);
  }

  tsOptions() {
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

    let appTree = new MergeTrees([jsTree, htmlTree])

    // Fingerprint assets for cache busting in production.
    if (isProduction) {
      let extensions = ['js', 'css'];
      let replaceExtensions = ['html', 'js', 'css'];

      appTree = new AssetRev(appTree, {
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
    const resolvableTree = find( new MergeTrees([compiledTypeScriptTree, compiledHandlebarsTree]), {
      srcDir: 'src'
    });

    // Build the file that maps individual modules onto the resolver's specifier
    // keys.
    const moduleMap = debug(this.buildResolutionMap(resolvableTree), { name: 'map' });

    // Merge the JavaScript source and generated module map together, making
    // sure to overwrite the stub module-map.js in the source tree with the
    // generated one.
    let jsTree = new MergeTrees([
      resolvableTree,
      moduleMap
    ], { overwrite: true });

    let rolledUp = this.rollupTree(jsTree);
    let es5 = this.babel(rolledUp);
    let loader = new Funnel(funnelLib('loader.js'), { files: ['loader.js'] })
    jsTree = new MergeTrees([es5, loader]);

    return new Concat(jsTree, {
      outputFile: `/app.js`,
      inputFiles: ['**/*'],
      headerFiles: ['loader.js'],
      footer: `requireModule('app')`
    });
  }

  compiledTypeScriptTree(srcTree, nodeModulesTree) {
    const tsOptions = this.tsOptions();

    return typescript(srcTree, tsOptions);
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
    return new Rollup(jsTree, {
      rollup: {
        format: 'es',
        entry: 'index.js',
        dest: 'app.js',
        sourceMap: 'inline',
        plugins:[
          nodeResolve({
            jsnext: true,
            main: true
          })
        ]
      }
    });
  }

  babel(jsTree) {
    let userOptions = this.options.babel || {};
    let plugins = [];
    if (this.options.babel && this.options.babel.plugins) {
      plugins = this.options.babel.plugins;
      delete this.options.babel.plugins;
    }

    let babelOptions = Object.assign(userOptions, {
      moduleIds: true,
      resolveModuleSource
    });

    babelOptions.plugins = babelPlugins.concat(plugins);
    return new Babel(jsTree, babelOptions);
  }

  minifyTree(jsTree) {
    return new Uglify(jsTree, {
      sourceMapConfig: {
        enable: false
      },
      mangle: true,
      compress: {
        // this is adversely affects heuristics for IIFE eval
        negate_iife: false,
        // limit sequences because of memory issues during parsing
        sequences: 30
      },
      output: {
        // no difference in size
        // and much easier to debug
        semicolons: false
      }
  });
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
    });
  }

  htmlTree() {
    let srcTree = this.trees.srcTree;

    const htmlName = this.options.outputPaths.app.html;
    const files = [
      'ui/index.html'
    ];

    const index = new Funnel(srcTree, {
      files,
      getDestinationPath(relativePath) {
        if (relativePath === 'ui/index.html') {
          relativePath = htmlName;
        }
        return relativePath;
      },
      annotation: 'Funnel: index.html'
    });

    return new ConfigReplace(index, this._configTree(), {
      configPath: join(this.name, 'config', 'environments', this.env + '.json'),
      files: [ htmlName ],
      patterns: this._configReplacePatterns()
    });
  }

  _configPath() {
    return join(this.name, 'config', 'environments', this.env + '.json');
  }

  _configTree() {
    if (this._cachedConfigTree) {
      return this._cachedConfigTree;
    }

    const configPath = this.project.configPath();
    const configTree = new ConfigLoader(dirname(configPath), {
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