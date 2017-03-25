const { precompile } = require('@glimmer/compiler');
const Filter = require('broccoli-persistent-filter');

class GlimmerTemplatePrecompiler extends Filter {

  constructor(inputNode, options) {
    super(...arguments);
    this.extensions = ['hbs'];
    this.targetExtension = 'js';
    this.options = options || {};
  }

  processString(content, relativePath) {
    let specifier = getTemplateSpecifier(this.options.rootName, relativePath);
    return `export default ${precompile(content, { meta: { specifier } })};`;
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

module.exports = GlimmerTemplatePrecompiler;
