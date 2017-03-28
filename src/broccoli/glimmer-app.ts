import defaultsDeep from 'lodash.defaultsdeep';

import ConfigLoader from 'broccoli-config-loader';
import ConfigReplace from 'broccoli-config-replace';

import Funnel from 'broccoli-funnel';
import * as path from 'path';
import fs from 'fs';
import { typescript } from 'broccoli-typescript-compiler';
import existsSync from 'exists-sync';
import merge from 'broccoli-merge-trees';
import assetRev from 'broccoli-asset-rev';
import uglify from 'broccoli-uglify-sourcemap';
import ResolutionMapBuilder from '@glimmer/resolution-map-builder';
import ResolverConfigurationBuilder from '@glimmer/resolver-configuration-builder';
import RollupWithDependencies from './rollup-with-dependencies';
import GlimmerTemplatePrecompiler from './glimmer-template-precompiler';
import defaultModuleConfiguration from './default-module-configuration';
import { WatchedDir, UnwatchedDir } from 'broccoli-source';

import Logger from 'heimdalljs-logger';
const logger = Logger('@glimmer/application-pipeline:glimmer-app');

import stew from 'broccoli-stew';
import { TypeScript } from "broccoli-typescript-compiler/lib/plugin";
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

export interface GlimmerAppOptions {
  outputPaths: any;
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
      match: /\{\{rootURL\}\}/g,
      replacement: () => '',
    }, {
      match: /\{\{content-for ['"](.+)["']\}\}/g,
      replacement: this.contentFor.bind(this)
    }];
  }

  buildTrees(): Trees {
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

  compiledTypeScriptTree(srcTree, nodeModulesTree): TypeScript {
    const tsOptions = this.tsOptions();

    let inputTrees = merge([nodeModulesTree, srcTree]);

    return typescript(inputTrees, tsOptions);
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
      configPath: this._configPath(),
      defaultModulePrefix: this.name,
      defaultModuleConfiguration
    });
  }

  buildResolverConfiguration() {
    return new ResolverConfigurationBuilder(this._configTree(), {
      configPath: this._configPath(),
      defaultModulePrefix: this.name,
      defaultModuleConfiguration
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
      configPath: this._configPath(),
      files: [ htmlName ],
      patterns: this._configReplacePatterns()
    });
  }

  contentFor(config, match: RegExp, type: string) {
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
