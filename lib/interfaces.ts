export interface Addon {
  contentFor: (type: string, config, content: string[]) => string;
  preprocessTree: (type: string, tree: Tree) => Tree;
  included: (GlimmerApp) => void;
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
    writeLine(contents: string);
    writeWarnLine(contents: string);
  }
}

export interface Tree {
  inputPaths: string[];
  outputPath: string;
  build(): void;
};

export type TreeEntry = Tree | string;

// documented rollup options from
// https://github.com/rollup/rollup/wiki/JavaScript-API#rolluprollup-options-
export interface RollupOptions {
  plugins?: any[],
  treeshake?: boolean,
  external?: string[] | ((id: string) => boolean);
  paths?: { [importId: string]: string } | ((id: string) => string);
}
