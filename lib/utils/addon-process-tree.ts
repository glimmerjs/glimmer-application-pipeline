'use strict';

export interface AddonHost {
  addons: Addon[]
}

export interface Addon {
  preprocessTree?(type: string, tree);
  postprocessTree?(type: string, tree);
}

export default function addonProcessTree(projectOrAddon: AddonHost, hook: 'preprocessTree' | 'postprocessTree', processType: string, tree) {
  return projectOrAddon.addons.reduce((workingTree, addon) => {
    if (addon[hook]) {
      return addon[hook](processType, workingTree);
    }

    return workingTree;
  }, tree);
};
