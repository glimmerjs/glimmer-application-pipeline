const path = require('path');
const Filter = require('broccoli-persistent-filter');
import { precompile } from '@glimmer/compiler';
import { PrecompileOptions, TemplateMeta } from '@glimmer/wire-format';

class GlimmerTemplatePrecompiler extends Filter {
  extensions = ['hbs'];
  targetExtension = 'ts';
  rootName: string;

  constructor(inputNode, options) {
    super(inputNode, { persist: false }); // TODO: enable persistent output

    this.rootName = options.rootName;
  }

  processString(content, relativePath) {
    let specifier = getTemplateSpecifier(this.rootName, relativePath);
    return 'export default ' + this.precompile(content, { meta: { specifier, '<template-meta>': true } }) + ';';
  }

  precompile(content: string, options: PrecompileOptions<TemplateMeta>): string {
    return precompile(content, options);
  }
}

export function getTemplateSpecifier(rootName, relativePath) {
  let path = relativePath.split('/');
  path.shift();

  // TODO - should use module map config to be rigorous
  if (path[path.length - 1] === 'template.hbs') {
    path.pop();
  }
  if (path[0] === 'ui') {
    path.shift();
  }

  return 'template:/' + rootName + '/' + path.join('/');
}

export default GlimmerTemplatePrecompiler;
