import { Tree } from "broccoli";
import { Registry } from "ember-cli-preprocess-registry/preprocessors";

// documented rollup options from
// https://github.com/rollup/rollup/wiki/JavaScript-API#rolluprollup-options-
export interface RollupOptions {
  plugins?: any[],
  treeshake?: boolean,
  external?: string[] | ((id: string) => boolean);
  paths?: { [importId: string]: string } | ((id: string) => string);
}

export type BabelPlugin = string | [string] | [string, any] | [any] | [any, any];

export interface GlimmerAppOptions {
  babel?: {
    spec?: boolean;
    loose?: boolean;
    debug?: boolean;
    include?: string[];
    exclude?: string[];
    useBuiltIns?: boolean;
    plugins?: BabelPlugin[];
  }
  outputPaths?: {
    app?: {
      html?: string;
      js?: string;
      css?: string;
    }
  }
  trees?: {
    src?: Tree | string;
    styles?: Tree | string;
    public?: Tree | string;
    nodeModules?: Tree | string;
    tests?: Tree | string;
  }
  registry?: Registry;
  rollup?: RollupOptions;
  sourcemaps?: { enabled?: boolean };
  storeConfigInMeta?: boolean;
  templateFormat?: 'json' | 'bytecode'
}
