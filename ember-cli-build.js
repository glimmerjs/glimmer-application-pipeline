"use strict";

const path = require('path');
const Funnel = require('broccoli-funnel');
const MergeTrees = require('broccoli-merge-trees');
const { TypeScriptPlugin } = require('broccoli-typescript-compiler');

module.exports = function() {
  let projectPath = __dirname;

  let libPath = path.join(projectPath, 'lib');
  let testsPath = path.join(projectPath, 'tests');

  let srcTrees = new MergeTrees([
    new Funnel(libPath, { destDir: 'lib' }),
    new Funnel(testsPath, { destDir: 'tests' })
  ]);

  let compiledTypescript = new TypeScriptPlugin(srcTrees);

  return compiledTypescript;
};
