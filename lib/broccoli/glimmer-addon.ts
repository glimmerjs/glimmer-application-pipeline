import MergeTrees = require("broccoli-merge-trees");
import Funnel = require("broccoli-funnel");
import FileCreator = require("broccoli-file-creator");
import fs = require("fs");

import { Tree } from "broccoli";

import GlimmerApp from "./glimmer-app";
import { EmberCLIDefaults } from "ember-build-utilities";

interface AddonTrees {
  lib: Tree;
  nodeModules: Tree;
}

interface GlimmerAddonOptions {
  name?: string;
}

export default class GlimmerAddon {
  protected trees: AddonTrees;
  protected defaults: EmberCLIDefaults;

  constructor(defaults: EmberCLIDefaults, options: GlimmerAddonOptions = {}) {
    this.trees = this.buildTrees(options);
    this.defaults = defaults;
  }

  protected buildTrees(options: GlimmerAddonOptions) {
    let { name } = options;

    let lib = new Funnel("src", {
      destDir: `${name}/src`
    });

    let nodeModules = new MergeTrees([
      "node_modules",
      lib,
      FileCreator(
        `${name}/package.json`,
        fs.readFileSync("package.json", "utf-8")
      )
    ]);

    return {
      lib,
      nodeModules
    };
  }

  public toTree() {
    let nodeModules = this.trees.nodeModules;

    let app = new GlimmerApp(this.defaults, {
      trees: {
        src: "tests/dummy/src",
        public: "tests/dummy/public",
        styles: "tests/dummy/src/ui/styles",
        nodeModules
      }
    });

    return new MergeTrees([app.toTree(), this.trees.lib]);
  }
}
