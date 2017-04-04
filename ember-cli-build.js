"use strict";

const path = require('path');
const Funnel = require('broccoli-funnel');
const compileTypescript = require('@glimmer/build/lib/compile-typescript');

module.exports = function() {
  let tsconfigPath = path.join(__dirname, 'tsconfig.json');
  let projectPath = __dirname;

  let libPath = path.join(projectPath, 'lib');
  let testsPath = path.join(projectPath, 'tests');

  let srcTrees = [
    new Funnel(libPath, { destDir: 'lib' }),
    new Funnel(testsPath, { destDir: 'tests' })
  ];

  let compiledTypescript = compileTypescript(
    tsconfigPath,
    projectPath,
    srcTrees
  );

  return compiledTypescript;
};
