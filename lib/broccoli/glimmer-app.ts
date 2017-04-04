'use strict';
const defaultsDeep = require('lodash.defaultsdeep');

const ConfigLoader = require('broccoli-config-loader');
const ConfigReplace = require('broccoli-config-replace');

const Funnel = require('broccoli-funnel');
const concat = require('broccoli-concat');
const path  = require('path');
const fs = require('fs');
const typescript = require('broccoli-typescript-compiler').typescript;
const existsSync = require('exists-sync');
const merge = require('broccoli-merge-trees');
const compileSass = require('broccoli-sass');
const assetRev = require('broccoli-asset-rev');
const uglify = require('broccoli-uglify-sourcemap');
const ResolutionMapBuilder = require('@glimmer/resolution-map-builder');
const ResolverConfigurationBuilder = require('@glimmer/resolver-configuration-builder');
const RollupWithDependencies = require('./rollup-with-dependencies');
const GlimmerTemplatePrecompiler = require('./glimmer-template-precompiler');
const defaultModuleConfiguration = require('./default-module-configuration');
const BroccoliSource = require('broccoli-source');
const WatchedDir = BroccoliSource.WatchedDir;
const UnwatchedDir = BroccoliSource.UnwatchedDir;

const Logger = require('heimdalljs-logger');
//const logger = Logger('@glimmer/application-pipeline:glimmer-app');

const stew  = require('broccoli-stew');
const find = stew.find;

import { TypeScript } from 'broccoli-typescript-compiler/lib/plugin';

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

export interface EmberCLIDefaults {
  project: Project
}

export interface GlimmerAppOptions {
  outputPaths?: any;
  trees?: {
    src?: string | Tree
  }
}

export interface Addon {
  contentFor: (type: string, config, content: string[]) => string;
}

export interface Project {
  root: string;
  name(): string;
  configPath(): string;
  addons: Addon[];

  pkg: {
    name: string;
  }
}

export interface Trees {
  srcTree: Tree;
  nodeModulesTree: Tree;
}

export interface Tree {

}

/**
 * GlimmerApp provides an interface to a package (app, engine, or addon)
 * compatible with the module unification layout.
 *
 * @class GlimmerApp
 * @constructor
 * @param {Object} [defaults]
 * @param {Object} [options={}] Configuration options
 */
export default class GlimmerApp {
  public options: GlimmerAppOptions;
  public project: Project;
  public name: string;
  public env: 'production' | 'development' | 'test';

  protected trees: Trees;
  protected srcPath: string;

  constructor(defaults: EmberCLIDefaults, options: GlimmerAppOptions = {}) {
    let missingProjectMessage = 'You must pass through the default arguments passed into your ember-cli-build.js file when constructing a new GlimmerApp';
    if (arguments.length === 0) {
      throw new Error(missingProjectMessage);
    }

    if (!defaults.project) {
      throw new Error(missingProjectMessage);
    }

    options = this.options = defaultsDeep(options, DEFAULT_CONFIG);

    this.env = process.env.EMBER_ENV || 'development';
    this.project = defaults.project;
    this.name = this.project.name();
    this.trees = this.buildTrees();

    let srcPath = options.srcPath || 'src';
    this.srcPath = this.resolveLocal(srcPath);
  }

  private _configReplacePatterns() {
    return [{
      match: /\{\{rootURL\}\}/g,
      replacement: (config) => config.rootURL || '',
    }, {
      match: /\{\{content-for ['"](.+)["']\}\}/g,
      replacement: this.contentFor.bind(this)
    }];
  }

  private buildTrees(): Trees {
    const srcPath = this.resolveLocal('src');
    const srcTree = existsSync(srcPath) ? new WatchedDir(srcPath) : null;

    const nodeModulesTree = new Funnel(new UnwatchedDir(this.project.root), {
      srcDir: 'node_modules/@glimmer',
      destDir: 'node_modules/@glimmer',
      include: [
        '**/*.d.ts',
        '**/package.json'
      ]
    });

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
  public toTree(options) {
    let isProduction = process.env.EMBER_ENV === 'production';

    let jsTree = this.javascriptTree();
    let cssTree = this.cssTree();
    let publicTree = this.publicTree();
    let htmlTree = this.htmlTree();

    // Minify the JavaScript in production builds.
    if (isProduction) {
      jsTree = this.minifyTree(jsTree);
    }

    let trees = [jsTree, htmlTree];
    if (cssTree) {
      trees.push(cssTree);
    }
    if (publicTree) {
      trees.push(publicTree);
    }

    let appTree = merge(trees);

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

  private javascriptTree() {
    let { srcTree, nodeModulesTree } = this.trees;

    // Grab the app's `src` directory.
    srcTree = find(srcTree, {
      destDir: 'src'
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

    // Build the resolver configuration file.
    const resolverConfiguration = this.buildResolverConfiguration();

    // Merge the JavaScript source and generated module map and resolver
    // configuration files together, making sure to overwrite the stub
    // module-map.js and resolver-configuration.js in the source tree with the
    // generated ones.
    let jsTree = merge([
      resolvableTree,
      moduleMap,
      resolverConfiguration
    ], { overwrite: true });

    // Finally, bundle the app into a single rolled up .js file.
    return this.rollupTree(jsTree);
  }

  private compiledTypeScriptTree(srcTree, nodeModulesTree): TypeScript {
    const tsOptions = this.tsOptions();

    let inputTrees = merge([nodeModulesTree, srcTree]);

    return typescript(inputTrees, tsOptions);
  }

  private compiledHandlebarsTree(srcTree) {
    let hbsTree = find(srcTree, {
      include: ['src/**/*.hbs']
    });

    return new GlimmerTemplatePrecompiler(hbsTree, {
      rootName: this.project.pkg.name
    });
  }

  private rollupTree(jsTree) {
    return new RollupWithDependencies(jsTree, {
      inputFiles: ['**/*.js'],
      rollup: {
        format: 'umd',
        entry: 'index.js',
        dest: 'app.js',
        sourceMap: 'inline'
      }
    });
  }

  private minifyTree(jsTree) {
    return uglify(jsTree, {
      compress: {
        screw_ie8: true,
      },
      sourceMapConfig: {
        enabled: false
      }
    });
  }

  private rewriteConfigEnvironment(src) {
    return new ConfigReplace(src, this._configTree(), {
      configPath: this._configPath(),
      files: [ 'config/environment.js' ],
      patterns: this._configReplacePatterns()
    });
  }

  private buildResolutionMap(src) {
    src = find(src, {
      exclude: ['config/**/*']
    });

    return new ResolutionMapBuilder(src, this._configTree(), {
      configPath: this._configPath(),
      defaultModulePrefix: this.name,
      defaultModuleConfiguration
    });
  }

  private buildResolverConfiguration() {
    return new ResolverConfigurationBuilder(this._configTree(), {
      configPath: this._configPath(),
      defaultModulePrefix: this.name,
      defaultModuleConfiguration
    });
  }

  private cssTree() {
    let stylesPath = path.join(this.srcPath, 'ui', 'styles');

    if (fs.existsSync(stylesPath)) {
      // Compile SASS if app.scss is present
      // (this works with imports from app.scss)
      let scssPath = path.join(stylesPath, 'app.scss');
      if (fs.existsSync(scssPath)) {
        return compileSass([stylesPath], 'app.scss', 'app.css', {
          annotation: 'Funnel: scss'
        });
      }

      // Otherwise concat all the css in the styles dir
      return concat(new Funnel(stylesPath, {
        include: ['**/*.css'],
        annotation: 'Funnel: css'}),
        { outputFile: 'app.css' });
    }
  }

  private publicTree() {
    let publicPath = 'public';

    if (fs.existsSync(publicPath)) {
      return new Funnel(publicPath, {
        annotation: 'Funnel: public'
      });
    }
  }

  private htmlTree() {
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
      configPath: this._configPath(),
      files: [ htmlName ],
      patterns: this._configReplacePatterns()
    });
  }

  private contentFor(config, match: RegExp, type: string) {
    let content: string[] = [];

    switch (type) {
      case 'head':
        this._contentForHead(content, config);
        break;
    }

    content = <string[]>this.project.addons.reduce(function(content: string[], addon: Addon): string[] {
      var addonContent = addon.contentFor ? addon.contentFor(type, config, content) : null;
      if (addonContent) {
        return content.concat(addonContent);
      }

      return content;
    }, content);

    return content.join('\n');
  }

  protected _contentForHead(content: string[], config) {
    // TODO?
    // content.push(calculateBaseTag(config));

    // TODO?
    // if (this.options.storeConfigInMeta) {
    //   content.push('<meta name="' + config.modulePrefix + '/config/environment" ' +
    //               'content="' + escape(JSON.stringify(config)) + '" />');
    // }
  }

  protected _configPath(): string {
    return path.join(this.name, 'config', 'environments', this.env + '.json');
  }

  _cachedConfigTree: any;

  protected _configTree() {
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
