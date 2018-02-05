import { buildDebugCallback } from 'broccoli-debug';
import { Tree } from 'broccoli';

const debugTree = buildDebugCallback('glimmer-app');

/**
 * Wraps a Broccoli tree with broccoli-debug if the GLIMMER_BUILD_DEBUG env
 * variable is set.
 */
export default function maybeDebug<T extends Tree>(inputTree: T, name: string): T;
export default function maybeDebug<T extends Tree>(inputTree: T | null, name: string): T | null;
export default function maybeDebug(inputTree: Tree | null, name: string): Tree | null {
  if (!process.env.GLIMMER_BUILD_DEBUG) {
    return inputTree || null;
  }

  // preserve `null` trees
  if (inputTree === null) {
    return inputTree;
  } else {
    return debugTree(inputTree as Tree, name);
  }
}
