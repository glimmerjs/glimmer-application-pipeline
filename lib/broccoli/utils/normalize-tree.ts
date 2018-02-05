import { Tree } from "broccoli";
import { WatchedDir } from "broccoli-source";
import { resolveLocal } from "ember-build-utilities";
import existsSync = require("exists-sync");

/**
 * Normalizes tree, string, or null values into a Broccoli tree.
 *
 * If passed a tree, normalizeTree() will return the same tree. If passed a
 * string, a tree for that path relative to the project root will be created. If
 * passed null, attempts to infer the path based on the default path. If a
 * directory exists at the default path, a tree for that directory will be
 * returned. Otherwise, returns null.
 */
export default function normalizeTree(tree: string, root: string, defaultPath: string): Tree;
export default function normalizeTree<T extends Tree>(tree: T, root: string, defaultPath: string): T;
export default function normalizeTree(tree: Tree | null | undefined, root: string, defaultPath: string): Tree | null;
export default function normalizeTree(tree: Tree | null | undefined, root: string, defaultPath: string): Tree | null {
  if (typeof tree === "string") {
    return new WatchedDir(resolveLocal(root, tree as string));
  } else if (!tree) {
    let path = resolveLocal(root, defaultPath);
    return existsSync(path) ? new WatchedDir(path) : null;
  } else {
    return tree;
  }
}
