import MergeTrees = require('broccoli-merge-trees');
import { Project } from 'ember-build-utilities';
import { Tree } from 'broccoli';

export function addonTreesFor(project: Project, type: string): Tree[] {
  return project.addons.reduce((sum, addon) => {
    if (addon.treeFor) {
      let val = addon.treeFor(type);
      if (val) { sum.push(val); }
    }
    return sum;
  }, [] as Tree[]);
}

export function addonLintTree(project: Project, type: string, tree: Tree): Tree {
  const lintTrees = project.addons.reduce((sum, addon) => {
    if (addon.lintTree) {
      let result = addon.lintTree(type, tree);
      if (result) {
        sum.push(result);
      }
    }

    return sum;
  }, [] as Tree[]);

  return new MergeTrees(lintTrees);
}
