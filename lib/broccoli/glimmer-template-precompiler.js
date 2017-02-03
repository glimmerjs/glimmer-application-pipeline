var Filter = require('broccoli-persistent-filter');
var compiler = require('@glimmer/compiler');

GlimmerTemplatePrecompiler.prototype = Object.create(Filter.prototype);
GlimmerTemplatePrecompiler.prototype.constructor = GlimmerTemplatePrecompiler;

function GlimmerTemplatePrecompiler(inputNode, options) {
  this.options = options || {};
  Filter.call(this, inputNode, {
    annotation: options.annotation
  });
}

GlimmerTemplatePrecompiler.prototype.extensions = ['hbs'];
GlimmerTemplatePrecompiler.prototype.targetExtension = 'js';

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

GlimmerTemplatePrecompiler.prototype.processString = function(content, relativePath) {
  console.log('GlimmerTemplatePrecompiler.processString', relativePath, this.options);

  let specifier = getTemplateSpecifier(this.options.rootName, relativePath);
  return 'export default ' + compiler.precompile(content, { meta: { specifier } }) + ';';
};

module.exports = GlimmerTemplatePrecompiler;
