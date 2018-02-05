import path = require("path");
import defaultsDeep = require("lodash.defaultsdeep");
import existsSync = require("exists-sync");

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

import {
  Project,
  addonProcessTree,
  GlimmerTemplatePrecompiler,
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
import defaultModuleConfiguration from "./default-module-configuration";
import { GlimmerAppOptions } from "../interfaces";
import TestEntrypointBuilder from "./test-entrypoint-builder";

const DEFAULT_TS_OPTIONS = {
  tsconfig: {
    compilerOptions: {
      target: "es5",
      module: "es2015",
      inlineSourceMap: true,
      inlineSources: true,
      moduleResolution: "node"
    },
    exclude: ["node_modules", "**/*.d.ts"]
  }
};

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
  public project: Project;
  public name: string;
  public env: "production" | "development" | "test";
  protected options: GlimmerAppOptions;
  protected trees: Trees;
  protected registry: Registry;
  protected outputPaths: OutputPaths;

  constructor(upstreamDefaults: EmberCLIDefaults, options: GlimmerAppOptions = {}) {
    if (arguments.length === 0 || !upstreamDefaults.project) {
      throw new MissingProjectError();
    }

    let env = process.env.EMBER_ENV || "development";
    let isProduction = env === "production";
    let defaults = getDefaultOptions(upstreamDefaults, isProduction);

    super(defaults, options);

    this.env = env;
    this.registry = options.registry || defaultRegistry(this);
    this.name = this.project.name();

    setupRegistry(this);

    this.trees = this.buildTrees(options);
    this.outputPaths = options.outputPaths as OutputPaths;

    this._notifyAddonIncluded();
  }

  public import() {
    throw new Error("app.import is not yet implemented for GlimmerApp");
  }

  /* Build Pipeline */

  /**
   * This hook is responsible for packaging assets together after they've been
   * individually compiled. It receives the application's JavaScript as "loose
   * modules" that are appropriate for bundling into optimized assets to be
   * distributed to the browser, using a tool like webpack or Rollup (the
   * default).
   */
  public package(jsTree: Tree | null, cssTree: Tree | null, publicTree: Tree | null, htmlTree: Tree | null): Tree {
    let trees: Tree[] = [];

    if (jsTree) {
      jsTree = this.rollupTree(jsTree);
      trees.push(jsTree);
    }

    if (htmlTree) {
      trees.push(htmlTree);
    }

    if (cssTree) {
      trees.push(cssTree);
    }

    if (publicTree) {
      trees.push(publicTree);
    }

    let appTree: Tree = new MergeTrees(trees);
    appTree = addonProcessTree(this.project, "postprocessTree", "all", appTree);

    return appTree;
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

    return {
      src: maybeDebug(srcTree, "src"),
      styles: maybeDebug(stylesTree, "styles"),
      public: maybeDebug(publicTree, "public"),
      nodeModules: nodeModulesTree
    };
  }

  private cssTree(): Tree | null {
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

  private publicTree() {
    let trees = [
      ...addonTreesFor(this.project, "public"),
      this.trees.public
    ].filter(Boolean);

    return new MergeTrees(trees as Tree[], { overwrite: true });
  }

  public htmlTree() {
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

  private contentFor(config: any, match: RegExp, type: string) {
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

  private tsOptions() {
    let tsconfigPath = resolveLocal(this.project.root, "tsconfig.json");
    let tsconfig;

    if (existsSync(tsconfigPath)) {
      try {
        tsconfig = require(tsconfigPath);
      } catch (err) {
        console.log("Error reading from tsconfig.json");
      }
    } else {
      console.log(
        "No tsconfig.json found; falling back to default TypeScript settings."
      );
    }

    return tsconfig ? { tsconfig } : DEFAULT_TS_OPTIONS;
  }

  private javascript(): Tree {
    let { src, nodeModules } = this.trees;

    let tsConfig = this.tsOptions();
    let glimmerEnv = this.getGlimmerEnvironment();
    let configTree = this.buildConfigTree(src!);
    let srcWithoutHBSTree = new Funnel(src, {
      exclude: ["**/*.hbs", "**/*.ts"]
    });

    // Compile the TypeScript and Handlebars files into JavaScript
    let compiledHandlebarsTree = this.compiledHandlebarsTree(src!, glimmerEnv);
    let combinedConfigAndCompiledHandlebarsTree = new MergeTrees([
      configTree,
      compiledHandlebarsTree
    ]);

    // the output tree from typescript only includes the output from .ts -> .js transpilation
    // and no other files from the original source tree
    let transpiledTypescriptTree = this.compiledTypeScriptTree(
      combinedConfigAndCompiledHandlebarsTree,
      nodeModules!,
      tsConfig
    );

    let trees = [srcWithoutHBSTree, transpiledTypescriptTree, configTree];
    if (this.env === "test") {
      const lintTrees = this.lint();
      trees.push(
        new TestEntrypointBuilder(
          new MergeTrees([transpiledTypescriptTree, ...lintTrees])
        )
      );
      trees.push(...lintTrees);
    }

    // Merge the JavaScript source and generated module map and resolver
    // configuration files together, making sure to overwrite the stub
    // module-map.js and resolver-configuration.js in the source tree with the
    // generated ones.
    transpiledTypescriptTree = new MergeTrees(trees, { overwrite: true });

    return this.processESLastest(transpiledTypescriptTree);
  }

  private processESLastest(tree: Tree): Tree {
    return preprocessJs(tree, "/", this.name, {
      registry: this.registry
    });
  }

  public getGlimmerEnvironment(): string {
    let config = this.project.config(this.project.env);

    return config.GlimmerENV || config.EmberENV;
  }

  private testPackage(): Tree | null {
    let jsTree = this.javascript();
    if (!jsTree) {
      return null;
    }

    return this.rollupTree(jsTree, {
      entry: "src/utils/test-helpers/test-helper.js",
      dest: "index.js"
    });
  }

  /**
   * Creates a Broccoli tree representing the compiled Glimmer application.
   *
   * @param options
   */
  public toTree() {
    if (this.env === "test") {
      return this.testPackage();
    }

    let jsTree = this.javascript();
    let cssTree = this.cssTree();
    let publicTree = this.publicTree();
    let htmlTree = this.htmlTree();

    return this.package(jsTree, cssTree, publicTree, htmlTree);
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

  private compiledTypeScriptTree(
    srcTree: Tree,
    nodeModulesTree: Tree,
    tsConfig: {}
  ): Tree {
    let inputTrees = new MergeTrees([nodeModulesTree, srcTree]);

    let compiledTypeScriptTree = typescript(inputTrees, tsConfig);

    return maybeDebug(compiledTypeScriptTree, "typescript-output");
  }

  private compiledHandlebarsTree(srcTree: Tree, glimmerEnv: string) {
    let compiledHandlebarsTree = new GlimmerTemplatePrecompiler(srcTree, {
      rootName: this.project.pkg.name,
      GlimmerENV: glimmerEnv
    });

    return maybeDebug(compiledHandlebarsTree, "handlebars-output");
  }

  private rollupTree(jsTree: Tree, options?: {}): Tree {
    let rollupOptions = Object.assign(
      {},
      this.options.rollup,
      {
        format: "umd",
        entry: "src/index.js",
        dest: this.outputPaths.app.js,
        sourceMap: this.options.sourcemaps!.enabled
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
      storeConfigInMeta: null
    },
    upstream
  );
}
