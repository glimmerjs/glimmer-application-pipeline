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
  let pathParts = relativePath.split('/');
  pathParts.shift();

  // TODO - should use module map config to be rigorous
  if (pathParts[pathParts.length - 1] === 'template.hbs') {
    pathParts.pop();
  }

  if (path.extname(pathParts[pathParts.length - 1]) === '.hbs') {
    let fileName = pathParts.pop();

    pathParts.push(path.basename(fileName, '.hbs'));
  }

  if (pathParts[0] === 'ui') {
    pathParts.shift();
  }

  return 'template:/' + rootName + '/' + pathParts.join('/');
}

export default GlimmerTemplatePrecompiler;
