import * as Filter from 'broccoli-persistent-filter';
import * as compiler from '@glimmer/compiler';

interface TemplateMeta {
  '<template-meta>': true;
  specifier: string;
}

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
    return 'export default ' + compiler.precompile<TemplateMeta>(content, { meta: { specifier, '<template-meta>': true } }) + ';';
  }
}

function getTemplateSpecifier(rootName, relativePath) {
  let path = relativePath.split('/');
  let prefix = path.shift();

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
