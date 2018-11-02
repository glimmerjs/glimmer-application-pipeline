import path = require("path");
import defaultsDeep = require("lodash.defaultsdeep");

import { Tree } from "broccoli";
import ConfigLoader = require("broccoli-config-loader");
import Funnel = require("broccoli-funnel");
import writeFile = require("broccoli-file-creator");
import { typescript } from "broccoli-typescript-compiler";
import { UnwatchedDir } from "broccoli-source";
import MergeTrees = require("broccoli-merge-trees");
import ConfigReplace = require("broccoli-config-replace");

import ResolutionMapBuilder = require("@glimmer/resolution-map-builder");
import ResolverConfigurationBuilder = require("@glimmer/resolver-configuration-builder");
import { GlimmerBundleCompiler } from "@glimmer/app-compiler";
import { ASTPluginBuilder } from "@glimmer/syntax";

import {
  Project,
  addonProcessTree,
  resolveLocal,
  AbstractBuild,
  EmberCLIDefaults,
  Addon
} from "ember-build-utilities";

import {
  Registry,
  setupRegistry,
  defaultRegistry,
  preprocessJs,
  preprocessCss
} from "ember-cli-preprocess-registry/preprocessors";

import maybeDebug from "./utils/maybe-debug";
import normalizeTree from "./utils/normalize-tree"
import { addonTreesFor, addonLintTree } from "./utils/addons";
import RollupWithDependencies from "./rollup-with-dependencies";
import GlimmerJSONCompiler from './compilers/glimmer-json-compiler';
import defaultModuleConfiguration from "./default-module-configuration";
import { GlimmerAppOptions } from "../interfaces";
import TestEntrypointBuilder from "./test-entrypoint-builder";

export interface OutputPaths {
  app: {
    html: string;
    js: string;
    css: string;
  };
}

export interface Trees {
  src: Tree;
  styles: Tree | null;
  public: Tree | null;
  nodeModules: Tree | null;
  tests: Tree | null;
}

export interface AssetTrees {
  html: Tree;
  js: Tree;
  css: Tree;
  public: Tree;
}

class MissingProjectError extends Error {
  message = "You must pass through the default arguments passed into your ember-cli-build.js file when constructing a new GlimmerApp";
}

export type GlimmerPossibleEnvironments = "production" | "development" | "test";

/**
 * GlimmerApp provides an interface to a package (app, engine, or addon)
 * compatible with the module unification layout.
 *
 * @class GlimmerApp
 * @constructor
 * @param {Object} [defaults]
 * @param {Object} [options=Options] Configuration options
 */
export default class GlimmerApp extends AbstractBuild {
  public project!: Project;
  public name: string;
  public env: GlimmerPossibleEnvironments;
  protected options!: GlimmerAppOptions;
  protected trees: Trees;
  protected registry: Registry;
  protected outputPaths: OutputPaths;
  protected templateFormat: 'json' | 'bytecode';

  constructor(upstreamDefaults: EmberCLIDefaults, options: GlimmerAppOptions = {}) {
    if (arguments.length === 0 || !upstreamDefaults.project) {
      throw new MissingProjectError();
    }

    let env = (process.env.EMBER_ENV as GlimmerPossibleEnvironments) || "development";
    let isProduction = env === "production";
    let defaults = getDefaultOptions(upstreamDefaults, isProduction);

    super(defaults, options);

    this.env = env;
    this.registry = options.registry || defaultRegistry(this);
    this.name = this.project.name();

    setupRegistry(this);

    this.trees = this.buildTrees(options);
    this.outputPaths = options.outputPaths as OutputPaths;
    this.templateFormat = options.templateFormat!;

    this._notifyAddonIncluded();
  }

  public import() {
    throw new Error("app.import is not yet implemented for GlimmerApp");
  }

  //
  // USER HOOKS
  //

  /**
   * This hook is responsible for compiling the application's files together
   * after they've been individually processed. It receives the application's
   * JavaScript as "loose modules" that are appropriate for bundling into
   * optimized assets to be distributed to the browser, using a tool like
   * webpack or Rollup (the default).
   */
  public package(appTree: Tree): Tree {
    let otherTrees: Tree[] = [];

    let jsTree: Tree = appTree;

    if (this.emitBytecodeTemplates) {
      let { gbxTree, dataSegmentTree } = this.compileTemplatesToBytecode(appTree);
      jsTree = new MergeTrees([dataSegmentTree, appTree], { overwrite: true });
      otherTrees.push(gbxTree);
    }

    jsTree = this.rollupTree(jsTree);

    appTree = new Funnel(appTree, {
      exclude: ['**/*.js', '**/*.hbs']
    });

    let trees = [appTree, jsTree, ...otherTrees];
    return new MergeTrees(trees);

  }

  /**
   * Creates a Broccoli tree representing the compiled Glimmer application.
   */
  public toTree(): Tree {
    let trees = [
      this.javascriptTree(),
      this.cssTree(),
      this.hbsTree(),
      this.htmlTree(),
    ].filter(Boolean) as Tree[];

    let appTree = new MergeTrees(trees);

    let packageTreeArray = [this.publicTree(), this.package(appTree)]

    if (this.env !== 'production' && this.trees.tests !== null) {
      packageTreeArray.push(this.testPackage())
    }

    let packagedTree = new MergeTrees(packageTreeArray);

    return addonProcessTree(this.project, "postprocessTree", "all", packagedTree);
  }

  /**
   * Initializes the trees containing application source code, including `src`,
   * `styles` and `node_modules`. Default paths are used unless explicitly
   * overridden.
   */
  private buildTrees(options: GlimmerAppOptions): Trees {
    let { trees } = options;
    let { project: { root } } = this;

    let srcTree = normalizeTree(trees && trees.src, root, "src");
    if (srcTree) {
      srcTree = new Funnel(srcTree, { destDir: "src" });

      // Allow addons to preprocess the src tree
      srcTree = addonProcessTree(this.project, "preprocessTree", "src", srcTree!);
    } else {
      throw new Error("Could not find a src/ directory. Create a directory called 'src' in the root of your project.");
    }

    let stylesTree = normalizeTree(
      trees && trees.styles,
      root,
      path.join("src", "ui", "styles")
    );

    if (stylesTree) {
      stylesTree = new Funnel(stylesTree, { destDir: "src/ui/styles" });
    }

    let publicTree = normalizeTree(trees && trees.public, root, "public");

    let nodeModulesTree =
      (trees && trees.nodeModules) ||
      new UnwatchedDir(resolveLocal(root, "node_modules"));

    if (nodeModulesTree) {
      nodeModulesTree = new Funnel(nodeModulesTree, { destDir: "node_modules/" });
    }

    let rawTestsTree = trees && trees.tests;
    let testsTree: Tree | null = normalizeTree(rawTestsTree, root, 'tests');

    if (testsTree) {
      testsTree = new Funnel(testsTree, {
        destDir: 'tests'
      });
    }


    return {
      src: maybeDebug(srcTree, "src"),
      styles: maybeDebug(stylesTree, "styles"),
      public: maybeDebug(publicTree, "public"),
      nodeModules: nodeModulesTree,
      tests: maybeDebug(testsTree, 'tests')
    };
  }

  //
  // TEMPLATE COMPILATION
  //

  /**
   * True if the app should emit templates as Glimmer binary bytecode.
   */
  protected get emitBytecodeTemplates() {
    return this.options.templateFormat === 'bytecode';
  }

  /**
   * Given a Broccoli tree containing `.hbs` files, returns a tree with those
   * templates transformed into their precompiled JSON form and saved as `.js`
   * files.
   */
  protected compileTemplatesToJSON(appTree: Tree): Tree {
    let glimmerEnv = this.getGlimmerEnvironment();
    let astPlugins = this.registry.load('glimmer-ast-plugin') as ASTPluginBuilder[];
    return new GlimmerJSONCompiler(appTree, {
      rootName: this.project.pkg.name,
      GlimmerENV: glimmerEnv,
      plugins: {
        ast: astPlugins
      }
    });
  }

  protected compileTemplatesToBytecode(appTree: Tree) {
    let { project: { root } } = this;

    // Template compiler needs access to root package.json
    let pkgJsonTree = new UnwatchedDir(root);
    pkgJsonTree = new Funnel(pkgJsonTree, {
      include: ['package.json']
    });

    let templateTree: Tree = new MergeTrees([appTree, pkgJsonTree]);
    let astPlugins = this.registry.load('glimmer-ast-plugin') as ASTPluginBuilder[];

    let compiledOutput = new GlimmerBundleCompiler(templateTree, {
      mode: 'module-unification',
      outputFiles: {
        heapFile: 'templates.gbx',
        dataSegment: 'src/data-segment.js'
      },
      bundleCompiler: {
        plugins: astPlugins
      }
    });

    templateTree = new Funnel(compiledOutput, {
      include: ['**/*.gbx']
    });

    let dataTree = new Funnel(compiledOutput, {
      include: ['**/*.js']
    });

    return {
      gbxTree: templateTree,
      dataSegmentTree: dataTree
    };
  }

  protected cssTree(): Tree | null {
    let { styles } = this.trees;

    if (!styles) { return null; }

    let preprocessedCssTree = addonProcessTree(
      this.project,
      "preprocessTree",
      "css",
      styles
    );

    let compiledCssTree = preprocessCss(
      preprocessedCssTree,
      "/src/ui/styles",
      "/assets",
      {
        outputPaths: { app: this.outputPaths.app.css },
        registry: this.registry
      }
    );

    return addonProcessTree(
      this.project,
      "postprocessTree",
      "css",
      compiledCssTree
    );
  }

  protected publicTree() {
    let trees = [
      ...addonTreesFor(this.project, "public"),
      this.trees.public
    ].filter(Boolean);

    return new MergeTrees(trees as Tree[], { overwrite: true });
  }

  protected htmlTree() {
    let srcTree = this.trees.src;

    const htmlName = this.outputPaths.app.html;
    const files = [
      'src/ui/index.html'
    ];

    const index = new Funnel(srcTree!, {
      files,
      annotation: 'Funnel: index.html',
      getDestinationPath(relativePath: string) {
        if (relativePath === 'src/ui/index.html') {
          relativePath = htmlName;
        }
        return relativePath;
      }
    });

    return new ConfigReplace(index, this._configTree(), {
      configPath: this.configPath,
      files: [htmlName],
      patterns: this._configReplacePatterns()
    });
  }

  public testHTMLTree() {
    let testsTree = this.trees.tests!;

    return new Funnel(testsTree, {
      files: [ 'tests/index.html' ],
      annotation: 'Funnel: tests/index.html'
    });
  }

  protected contentFor(config: any, match: RegExp, type: string) {
    let content: string[] = [];

    switch (type) {
      case 'head':
        this._contentForHead(content, config);
        break;
    }

    content = <string[]>this.project.addons.reduce(function (content: string[], addon: Addon): string[] {
      var addonContent = addon.contentFor ? addon.contentFor(type, config, content) : null;
      if (addonContent) {
        return content.concat(addonContent);
      }

      return content;
    }, content);

    return content.join('\n');
  }

  protected _contentForHead(content: string[], config: any) {
    if (this.options.storeConfigInMeta) {
      content.push('<meta name="' + config.modulePrefix + '/config/environment" ' +
        'content="' + encodeURIComponent(JSON.stringify(config)) + '" />');
    }
  }

  private _configReplacePatterns() {
    return [{
      match: /\{\{rootURL\}\}/g,
      replacement: (config: any) => config.rootURL || '',
    }, {
      match: /\{\{content-for ['"](.+)["']\}\}/g,
      replacement: this.contentFor.bind(this)
    }];
  }

  /**
   * Produces a Broccoli tree of all of the JavaScript files in the app as loose
   * modules. Anything that is to be represented as JavaScript in the final
   * output, such as TypeScript, should be transpiled here. Final packaging of
   * the JavaScript modules happens in the `package()` hook.
   */
  protected javascriptTree(): Tree {
    let { src: srcTree, nodeModules: nodeModulesTree } = this.trees;

    // Generate configuration files
    let configTree: Tree = this.buildConfigTree(srcTree);

    // the output tree from typescript only includes the output from .ts -> .js transpilation
    // and no other files from the original source tree
    let tsInput = new MergeTrees([configTree, srcTree, nodeModulesTree!]);
    let tsTree = typescript(tsInput, {
      workingPath: this.project.root
    });

    let jsTrees: Tree[] = [configTree, tsTree];

    if (this.options.templateFormat === 'json') {
      // Compile Handlebars templates to JavaScript
      jsTrees.push(this.compileTemplatesToJSON(srcTree));
    }

    if (this.env !== "production") {
      const lintTrees = this.lint();
      jsTrees.push(
        new TestEntrypointBuilder(
          new MergeTrees([tsTree, ...lintTrees])
        )
      );
      jsTrees.push(...lintTrees);
    }

    // Merge the JavaScript source and generated module map and resolver
    // configuration files together, making sure to overwrite the stub
    // module-map.js and resolver-configuration.js in the source tree with the
    // generated ones.
    let jsTree: Tree = new MergeTrees(jsTrees, { overwrite: true });

    jsTree = new Funnel(jsTree, {
      include: ['**/*.js']
    });

    return this.processESLatest(jsTree);
  }

  private hbsTree(): Tree {
    let { src } = this.trees;

    return new Funnel(src, {
      include: ['**/*.hbs']
    });
  }

  private processESLatest(tree: Tree): Tree {
    return preprocessJs(tree, "/", this.name, {
      registry: this.registry
    });
  }

  public getGlimmerEnvironment(): string {
    let config = this.project.config(this.project.env);

    return config.GlimmerENV || config.EmberENV;
  }

  private testPackage(): Tree {
    let jsTree = this.javascriptTree();

    jsTree = this.rollupTree(jsTree, {
      input: "src/utils/test-helpers/test-helper.js",
      output: {
        format: "umd",
        file: "tests/index.js",
        sourcemap: this.options.sourcemaps!.enabled
      }
    });

    let trees = [jsTree];

    if (this.trees.tests !== null)  {
      trees.push(this.testHTMLTree());
    }

    return new MergeTrees(trees);
  }

  private lint() {
    let { src } = this.trees;

    let templateTree = new Funnel(src, {
      include: ["**/*.hbs"]
    });

    let srcTree = new Funnel(src, {
      exclude: ["**/*.hbs"]
    });

    let lintedTemplates = addonLintTree(
      this.project,
      "templates",
      templateTree
    );
    let lintedSrc = addonLintTree(this.project, "src", srcTree);

    return [lintedTemplates, lintedSrc];
  }

  private rollupTree(jsTree: Tree, options?: {}): Tree {
    let rollupOptions = Object.assign(
      {},
      this.options.rollup,
      {
        input: "src/index.js",
        output: {
          format: "umd",
          file: this.outputPaths.app.js,
          sourcemap: this.options.sourcemaps!.enabled
        }
      },
      options
    );

    return new RollupWithDependencies(maybeDebug(jsTree, "rollup-input-tree"), {
      inputFiles: ["**/*.js"],
      rollup: rollupOptions,
      project: this.project,
      buildConfig: this.options
    });
  }

  private buildConfigTree(postTranspiledSrc: Tree) {
    // Build the file that maps individual modules onto the resolver's specifier
    // keys.
    const moduleMap = this.buildResolutionMap(postTranspiledSrc);

    // Build the resolver configuration file.
    const resolverConfiguration = this.buildResolverConfiguration();

    let configEnvironment;
    if (this.options.storeConfigInMeta === true) {
      configEnvironment = new MergeTrees([
        writeFile(
          "config/environment.js",
          `
          var config;
          try {
            var metaName = '${this.name}/config/environment';
            var rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
            config = JSON.parse(decodeURIComponent(rawConfig));
          }
          catch(err) {
            throw new Error('Could not read config from meta tag with name "' + metaName + '".');
          }

          export default config;
        `
        ),
        writeFile(
          "config/environment.d.ts",
          `declare let config: any; export default config;`
        )
      ]);
    }

    const configTree = this._configTree();

    return maybeDebug(
      new MergeTrees(
        [
          moduleMap,
          resolverConfiguration,
          configEnvironment,
          configTree
        ].filter(Boolean)
      ),
      "config:output"
    );
  }

  private buildResolutionMap(src: Tree) {
    return new ResolutionMapBuilder(src as any, this._configTree(), {
      srcDir: "src",
      configPath: this.configPath,
      defaultModulePrefix: this.name,
      defaultModuleConfiguration
    });
  }

  private buildResolverConfiguration() {
    return new ResolverConfigurationBuilder(this._configTree(), {
      configPath: this.configPath,
      defaultModulePrefix: this.name,
      defaultModuleConfiguration
    });
  }

  /* Configuration */

  protected get configPath(): string {
    return path.join("config", "environments", this.env + ".json");
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
      srcDir: "/",
      destDir: "config",
      annotation: "Funnel (config)"
    });

    this._cachedConfigTree = maybeDebug(namespacedConfigTree, "config-tree");

    return this._cachedConfigTree;
  }
}

/**
 * Merges the default options passed by Ember CLI with the default options
 * provided by Glimmer.
 */
function getDefaultOptions(upstream: EmberCLIDefaults, isProduction: boolean): EmberCLIDefaults {
  return defaultsDeep(
    {},
    {
      addons: {
        whitelist: null as string[] | null,
        blacklist: null as string[] | null
      },
      outputPaths: {
        app: {
          html: "index.html",
          js: "app.js",
          css: "app.css"
        }
      },
      rollup: {},
      minifyJS: {
        enabled: isProduction,

        options: {
          compress: {
            // this is adversely affects heuristics for IIFE eval
            negate_iife: false,
            // limit sequences because of memory issues during parsing
            sequences: 30
          },
          output: {
            // no difference in size and much easier to debug
            semicolons: false
          }
        }
      },
      sourcemaps: {
        enabled: !isProduction
      },
      storeConfigInMeta: null,
      templateFormat: 'json'
    },
    upstream
  );
}
