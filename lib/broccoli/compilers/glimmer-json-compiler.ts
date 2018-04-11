import { GlimmerTemplatePrecompiler, GlimmerTemplatePrecompilerOptions } from 'ember-build-utilities';
import { Tree } from 'broccoli';

/**
 * Subclasses the Glimmer template compiler from ember-build-utilities to emit
 * files with a `.js` extension instead of `.ts`.
 */
export default class GlimmerJSONCompiler extends GlimmerTemplatePrecompiler {
  targetExtension: string;

  constructor(inputNode: Tree, options: GlimmerTemplatePrecompilerOptions) {
    super(inputNode, options);
    this.targetExtension = 'js';
  }
}
