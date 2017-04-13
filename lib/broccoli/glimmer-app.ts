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
const BroccoliSource = require('broccoli-source');
const WatchedDir = BroccoliSource.WatchedDir;
const UnwatchedDir = BroccoliSource.UnwatchedDir;
const SilentError = require('silent-error');
const stripIndent = require('common-tags').stripIndent;

import RollupWithDependencies from './rollup-with-dependencies';
import GlimmerTemplatePrecompiler from './glimmer-template-precompiler';
import defaultModuleConfiguration from './default-module-configuration';
import addonProcessTree from '../utils/addon-process-tree';

//const Logger = require('heimdalljs-logger');
//const logger = Logger('@glimmer/application-pipeline:glimmer-app');


import { TypeScript } from 'broccoli-typescript-compiler/lib/plugin';

function maybeDebug(inputTree: Tree, name: string) {
  if (!process.env.GLIMMER_BUILD_DEBUG) {
    return inputTree;
  }

  const debug = require('broccoli-stew').debug;

  // preserve `null` trees
  if (!inputTree) {
    return inputTree;
  }

  return debug(inputTree, { name });
}

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

export interface OutputPaths {
  app: {
    html: string;
    js: string;
    css: string;
  }
}
export interface EmberCLIDefaults {
  project: Project
}

// documented rollup options from
// https://github.com/rollup/rollup/wiki/JavaScript-API#rolluprollup-options-
export interface RollupOptions {
  plugins?: any[],
  treeshake?: boolean,
  external?: string[] | ((id: string) => boolean);
  paths?: { [importId: string]: string } | ((id: string) => string);
}

export interface GlimmerAppOptions {
  outputPaths?: {
    app?: {
      html?: string;
      js?: string;
      css?: string;
    }
  }
  trees?: {
    src?: Tree | string;
    nodeModules?: Tree | string;
  }
  rollup?: RollupOptions;
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
  src: Tree;
  nodeModules: Tree;
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
 * @param {Object} [options=Options] Configuration options
 */
export default class GlimmerApp {
  public project: Project;
  public name: string;
  public env: 'production' | 'development' | 'test';
  private outputPaths: OutputPaths;
  private rollupOptions: RollupOptions;

  protected trees: Trees;

  constructor(defaults: EmberCLIDefaults, options: GlimmerAppOptions = {}) {
    let missingProjectMessage = 'You must pass through the default arguments passed into your ember-cli-build.js file when constructing a new GlimmerApp';
    if (arguments.length === 0) {
      throw new Error(missingProjectMessage);
    }

    if (!defaults.project) {
      throw new Error(missingProjectMessage);
    }

    this.env = process.env.EMBER_ENV || 'development';
    this.project = defaults.project;
    this.name = this.project.name();

    this.rollupOptions = options.rollup || {};
    this.trees = this.buildTrees(options);
    this.outputPaths = this.buildOutputPaths(options);
    this.detectInvalidBlueprint(options);
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

  private buildOutputPaths(options: GlimmerAppOptions): OutputPaths {
    return defaultsDeep({}, options.outputPaths, {
      app: {
        html: 'index.html',
        js: 'app.js',
        css: 'app.css'
      }
    });
  }

  private buildTrees(options: GlimmerAppOptions): Trees {
    let srcTree = options.trees && options.trees.src;

    if (typeof srcTree === 'string') {
      srcTree = new WatchedDir(this.resolveLocal(srcTree));
    } else if (!srcTree) {
      let srcPath = this.resolveLocal('src');
      srcTree = existsSync(srcPath) ? new WatchedDir(srcPath) : null;
    }

    if (srcTree) {
      srcTree = new Funnel(srcTree, {
        destDir: 'src'
      });

      srcTree = addonProcessTree(this.project, 'preprocessTree', 'src', srcTree);
    }

    let nodeModulesTree = options.trees && options.trees.nodeModules || new UnwatchedDir(this.resolveLocal('node_modules'));

    if (nodeModulesTree) {
      nodeModulesTree = new Funnel(nodeModulesTree, {
        destDir: 'node_modules/'
      });
    }

    return {
      src: maybeDebug(srcTree, 'src'),
      nodeModules: nodeModulesTree
    }
  }

  private resolveLocal(to: string) {
    // return argument if it is absolute
    if (to[0] === '/') {
      return to;
    }

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
  public toTree() {
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
    let { src, nodeModules } = this.trees;

    const configTree = this.buildConfigTree(src);

    let srcWithoutHBSTree = new Funnel(src, {
      exclude: ['**/*.hbs', '**/*.ts']
    });

    // Compile the TypeScript and Handlebars files into JavaScript
    const compiledHandlebarsTree = this.compiledHandlebarsTree(src);
    const combinedConfigAndCompiledHandlebarsTree = merge([configTree, compiledHandlebarsTree]);
    const compiledTypeScriptTree = this.compiledTypeScriptTree(combinedConfigAndCompiledHandlebarsTree, nodeModules)

    // the output tree from typescript only includes the output from .ts -> .js transpilation
    // and no other files from the original source tree
    const combinedHandlebarsAndTypescriptTree = merge([srcWithoutHBSTree, compiledTypeScriptTree], { overwrite: true});

    // Merge the JavaScript source and generated module map and resolver
    // configuration files together, making sure to overwrite the stub
    // module-map.js and resolver-configuration.js in the source tree with the
    // generated ones.
    let jsTree = merge([combinedHandlebarsAndTypescriptTree, configTree], { overwrite: true });


    // Finally, bundle the app into a single rolled up .js file.
    return this.rollupTree(jsTree);
  }

  private compiledTypeScriptTree(srcTree, nodeModulesTree): TypeScript {
    const tsOptions = this.tsOptions();

    let inputTrees = merge([nodeModulesTree, srcTree]);

    let compiledTypeScriptTree = typescript(inputTrees, tsOptions);

    return maybeDebug(compiledTypeScriptTree, 'typescript-output');
  }

  private compiledHandlebarsTree(srcTree) {
    let compiledHandlebarsTree = new GlimmerTemplatePrecompiler(srcTree, {
      rootName: this.project.pkg.name
    });

    return maybeDebug(compiledHandlebarsTree, 'handlebars-output');
  }

  private rollupTree(jsTree) {
    let rollupOptions = Object.assign({}, this.rollupOptions, {
        format: 'umd',
        entry: 'src/index.js',
        dest: this.outputPaths.app.js,
        sourceMap: 'inline'
    });

    return new RollupWithDependencies(maybeDebug(jsTree, 'rollup-input-tree'), {
      inputFiles: ['**/*.js'],
      rollup: rollupOptions
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

  private buildConfigTree(postTranspiledSrc) {
    // Build the file that maps individual modules onto the resolver's specifier
    // keys.
    const moduleMap = this.buildResolutionMap(postTranspiledSrc);

    // Build the resolver configuration file.
    const resolverConfiguration = this.buildResolverConfiguration();

    const configTree = this._configTree();

    return merge([moduleMap, resolverConfiguration, configTree]);
  }

  private buildResolutionMap(src) {
    return new ResolutionMapBuilder(src, this._configTree(), {
      baseDir: 'src',
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
    // should really make SASS support to be opt-in, so that
    // we can properly honor the `GlimmerAppOptions.trees.src`
    // abstraction here, but for now we still require `src` to be a
    // "real" path on disk that we check
    let stylesPath = path.join(this.resolveLocal('src'), 'ui', 'styles');

    if (fs.existsSync(stylesPath)) {
      // Compile SASS if app.scss is present
      // (this works with imports from app.scss)
      let scssPath = path.join(stylesPath, 'app.scss');
      if (fs.existsSync(scssPath)) {
        return compileSass([stylesPath], 'app.scss', this.outputPaths.app.css, {
          annotation: 'Funnel: scss'
        });
      }

      // Otherwise concat all the css in the styles dir
      return concat(new Funnel(stylesPath, {
        include: ['**/*.css'],
        annotation: 'Funnel: css'}),
        { outputFile: this.outputPaths.app.css });
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
    let srcTree = this.trees.src;

    const htmlName = this.outputPaths.app.html;
    const files = [
      'src/ui/index.html'
    ];

    const index = new Funnel(srcTree, {
      files,
      getDestinationPath(relativePath) {
        if (relativePath === 'src/ui/index.html') {
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
    return path.join('config', 'environments', this.env + '.json');
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

    let namespacedConfigTree = new Funnel(configTree, {
      srcDir: '/',
      destDir: 'config',
      annotation: 'Funnel (config)'
    });

    this._cachedConfigTree = maybeDebug(namespacedConfigTree, 'config-tree');

    return this._cachedConfigTree;
  }

  private detectInvalidBlueprint(options) {
    let srcPath = options.trees && options.trees.src || 'src';
    let resolvedSrcPath;

    if (typeof srcPath === 'string') {
      resolvedSrcPath = this.resolveLocal(srcPath)
    }

    if (!resolvedSrcPath || !existsSync(resolvedSrcPath)) { return; } // cannot do detection
    let mainPath = path.join(resolvedSrcPath, 'main.ts');

    if (existsSync(mainPath)) {
      let mainContents = fs.readFileSync(path.join(resolvedSrcPath, 'main.ts')).toString();

      let hasModuleMapInSrc = mainContents.includes(`'./config/module-map`) || mainContents.includes(`"./config/module-map"`);
      let hasResolverConfigInSrc = mainContents.includes(`'./config/resolver-configuration`) || mainContents.includes(`"./config/resolver-configuration`);

      if (hasModuleMapInSrc || hasResolverConfigInSrc) {
        throw new SilentError(stripIndent`
          Updates to your project structure are required to run with this version of @glimmer/application-pipeline.

          Please update your project by running:

            yarn upgrade @glimmer/blueprint
            ember init -b @glimmer/blueprint
        `);
      }
    }
  }
}
