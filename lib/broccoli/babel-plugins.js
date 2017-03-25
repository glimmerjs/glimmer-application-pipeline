const { dirname } = require('path');

module.exports = [
  [addBaseDir(require('babel-plugin-minify-numeric-literals'))],
  [addBaseDir(require('babel-plugin-transform-es2015-template-literals')), {loose: true}],
  [addBaseDir(require('babel-plugin-transform-es2015-arrow-functions'))],
  [addBaseDir(require('babel-plugin-transform-es2015-destructuring')), {loose: true}],
  [addBaseDir(require('babel-plugin-transform-es2015-spread')), {loose: true}],
  [addBaseDir(require('babel-plugin-transform-es2015-parameters'))],
  [addBaseDir(require('babel-plugin-transform-es2015-computed-properties')), {loose: true}],
  [addBaseDir(require('babel-plugin-transform-es2015-shorthand-properties'))],
  [addBaseDir(require('babel-plugin-transform-es2015-block-scoping'))],
  [addBaseDir(require('babel-plugin-check-es2015-constants'))],
  [addBaseDir(require('babel-plugin-transform-es2015-classes')), {loose: true}],
  [addBaseDir(require('babel-plugin-transform-es2015-modules-amd')), { noInterop: true, strict: true }],
  [addBaseDir(require('babel-plugin-transform-proto-to-assign'))],
  [addBaseDir(require('babel-plugin-transform-es2015-for-of'))]
];

function addBaseDir(Plugin) {
  let type = typeof Plugin;

  if (type === 'function' && !Plugin.baseDir) {
    Plugin.baseDir = () => dirname(dirname(__dirname));
  } else if (type === 'object' && Plugin !== null && Plugin.default) {
    addBaseDir(Plugin.default);
  }

  return Plugin;
}
