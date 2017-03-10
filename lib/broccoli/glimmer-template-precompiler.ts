import * as Filter from 'broccoli-persistent-filter';
import * as compiler from '@glimmer/compiler';

class GlimmerTemplatePrecompiler extends Filter {
  extensions = ['hbs'];
  targetExtension = 'js';
  options: any;

  constructor(inputNode, options) {
    super(...arguments)
    this.options = options || {};
  }

  processString(content, relativePath) {
    let specifier = getTemplateSpecifier(this.options.rootName, relativePath);
    return 'export default ' + compiler.precompile(content, { meta: { specifier } }) + ';';
  }
}

function getTemplateSpecifier(rootName, relativePath) {
  let path = relativePath.split('/');

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
