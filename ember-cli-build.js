"use strict";

const path = require('path');
const Funnel = require('broccoli-funnel');
const compileTypescript = require('@glimmer/build/lib/compile-typescript');

module.exports = function() {
  let tsconfigPath = path.join(__dirname, 'tsconfig.json');
  let projectPath = __dirname;

  let srcPath = path.join(projectPath, 'src');
  let testsPath = path.join(projectPath, 'tests');

  let srcTrees = [
    new Funnel(srcPath, { destDir: 'src' }),
    new Funnel(testsPath, { destDir: 'tests' })
  ];

  let compiledTypescript = compileTypescript(
    tsconfigPath,
    projectPath,
    srcTrees
  );

  return compiledTypescript;
};
