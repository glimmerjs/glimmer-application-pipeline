declare module "exists-sync" {
  function existsSync(path: string): boolean;
  export = existsSync;
}

/**
 * Broccoli
 */

declare module "broccoli" {
  import Plugin from "broccoli-plugin";
  import { WatchedDir, UnwatchedDir } from "broccoli-source";

  export type Tree = string | Plugin | WatchedDir | UnwatchedDir;
}

declare module "broccoli-plugin" {
  class Plugin {
    inputPaths: string[];
    outputPath: string;
    build(): void;
  }

  export default Plugin;
}

declare module "broccoli-source" {
  import Plugin from "broccoli-plugin";

  export class WatchedDir extends Plugin {
    constructor(path: string);
  }

  export class UnwatchedDir {
    constructor(path: string);
  }
}

declare module "broccoli-caching-writer" {
  import Plugin from "broccoli-plugin";
  import { Tree } from "broccoli";

  class CachingWriterPlugin extends Plugin {
    constructor(trees: Tree[], options: any);
  }

  export = CachingWriterPlugin;
}

declare module "broccoli-debug" {
  import { Tree } from "broccoli";

  type DebugTreeFunction = (tree: Tree, name: string) => Tree;

  export function buildDebugCallback(name: string): DebugTreeFunction;
}

declare module "broccoli-config-replace" {
  import { Tree } from "broccoli";

  interface ConfigReplaceOptions {
    configPath: string;
    files: string[];
    patterns: { match: RegExp, replacement: (config: any) => string; }[];
  }

  class ConfigReplace {
    constructor(appTree: Tree, configTree: Tree, options: ConfigReplaceOptions);
  }

  export = ConfigReplace;
}

declare module "broccoli-config-loader" {
  import { Tree } from "broccoli";
  import { Project } from "ember-build-utilities";

  interface ConfigLoaderOptions {
    env: string;
    project: Project;
  }

  class ConfigLoader {
    constructor(tree: Tree, options: ConfigLoaderOptions);
  }

  export = ConfigLoader;
}

declare module "broccoli-funnel" {
  import { Tree } from "broccoli";

  interface FunnelOptions {
    annotation?: string;
    srcDir?: string;
    destDir?: string;
    include?: string[];
    files?: string[];
    exclude?: string[];
    getDestinationPath?: (relPath: string) => string;
  }

  class Funnel {
    constructor(tree: Tree, options: FunnelOptions);
  }

  export = Funnel;
}

declare module "broccoli-file-creator" {
  import { Tree } from "broccoli";

  function writeFile(path: string, contents: string): Tree;
  export = writeFile;
}

declare module "broccoli-merge-trees" {
  import { Tree } from "broccoli";
  import Plugin from "broccoli-plugin";

  interface MergeTreesOptions {
    overwrite?: boolean;
  }

  class MergeTrees extends Plugin {
    constructor(trees: Tree[], options?: MergeTreesOptions);
  }

  export = MergeTrees;
}

declare module "broccoli-rollup" {
  import Plugin from "broccoli-plugin";
  import { Tree } from "broccoli";

  class Rollup extends Plugin {
    constructor(tree: Tree, options: any);
  }

  export = Rollup;
}

/**
 * Babel Plugins
 */

declare module "babel-preset-env";
declare module "babel-plugin-debug-macros";
declare module "babel-plugin-external-helpers";
declare module "babel-plugin-glimmer-inline-precompile";

/**
 * Rollup Plugins
 */

declare module "rollup-plugin-node-resolve";
declare module "rollup-plugin-babel";

/**
 * Glimmer
 */

declare module "@glimmer/resolution-map-builder" {
  import { Tree } from "broccoli";

  interface ResolutionMapBuilderOptions {
    srcDir?: string;
    configPath?: string;
    defaultModulePrefix?: string;
    defaultModuleConfiguration?: any;
  }

  class ResolutionMapBuilder {
    constructor(appTree: Tree, configTree: Tree, options: ResolutionMapBuilderOptions);
  }

  export = ResolutionMapBuilder;
}

declare module "@glimmer/resolver-configuration-builder" {
  import { Tree } from "broccoli";

  interface ResolverConfigurationBuilderOptions {
    configPath: string;
    defaultModulePrefix: string;
    defaultModuleConfiguration: any;
  }

  class ResolverConfigurationBuilder {
    constructor(tree: Tree, options: ResolverConfigurationBuilderOptions);
  }

  export = ResolverConfigurationBuilder;
}
/**
 * Ember CLI
 */

declare module "ember-cli-preprocess-registry/preprocessors" {
  import { AbstractBuild } from "ember-build-utilities";
  import { Tree } from "broccoli";

  export interface Registry {
    add(type: string, plugin: Function): void;
    load(type: string): Function[];
  }

  export function setupRegistry(app: AbstractBuild): void;
  export function defaultRegistry(app: AbstractBuild): Registry;
  export function preprocessJs(jsTree: Tree, inputPath: string, outputPath: string, options: any): Tree;
  export function preprocessCss(cssTree: Tree, inputPath: string, outputPath: string, options: any): Tree;
}

declare module "ember-cli-blueprint-test-helpers/chai" {
  export { expect } from "chai";
}

declare module "ember-cli-blueprint-test-helpers/helpers" {
  type FileHelper = (path: string) => string;

  export function emberGenerateDestroy(args: string[], cb: (file: FileHelper) => void): Promise<void>;
  export function emberGenerate(args: string[]): Promise<void>;
  export function emberNew(): Promise<void>;
  export function setupTestHooks(ctx: Mocha.ISuiteCallbackContext): void;
}

declare module "ember-build-utilities" {
  import { Tree } from "broccoli";
  import { ASTPluginBuilder } from "@glimmer/syntax"
  export function addonProcessTree(project: Project, hook: string, target: string, tree: Tree): Tree;

  interface GlimmerTemplatePrecompilerOptions {
    rootName: string;
    GlimmerENV: string;
    plugins: { ast: ASTPluginBuilder[] }
  }

  export class GlimmerTemplatePrecompiler {
    constructor(tree: Tree, options: GlimmerTemplatePrecompilerOptions);
  }

  export function resolveLocal(root: string, path: string): string;

  export interface Addon {
    contentFor: (type: string, config: {}, content: string[]) => string;
    preprocessTree: (type: string, tree: Tree) => Tree;
    included: (app: AbstractBuild) => void;
    treeFor: (type: string) => Tree;
    lintTree: (type: string, tree: Tree) => Tree;
  }

  export interface Project {
    root: string;
    name(): string;
    env: string;
    configPath(): string;
    config(env: string): any;
    addons: Addon[];

    findAddonByName(name: string): Addon | null;

    targets: any;

    pkg: {
      name: string;
    }

    ui: {
      writeLine(contents: string): void;
      writeWarnLine(contents: string): void;
    }
  }

  export interface EmberCLIDefaults {
    project: Project
  }

  export class AbstractBuild {
    constructor(defaults: EmberCLIDefaults, options: {});
    _notifyAddonIncluded(): void;
    package(jsTree: Tree, cssTree: Tree, publicTree: Tree, htmlTree: Tree): Tree;
  }
}