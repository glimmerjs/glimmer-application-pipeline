'use strict';

const fs = require('fs');
const path = require('path');
const walkSync = require('walk-sync');

import { Tree, TreeEntry } from '../interfaces';

export const Plugin: {
  new (inputNode: TreeEntry[], options?): Tree;
} = require('broccoli-caching-writer');

export default class TestEntrypointBuilder extends Plugin {
  constructor(testTree, public options = {}) {
    super([testTree], {
      annotation: options['annotation']
    });
  }

  build() {
    let testDir = this.inputPaths[0];
    let testFiles = walkSync(testDir);

    function isTest({ name }) { return name.match(/\-test$/); }
    function asImportStatement({ dir, name }) {
      let testDirRelativePath = `./${path.join(dir, name)}`;
      return `import '${testDirRelativePath}';\n`;
    }

    let contents = testFiles.map(path.parse).filter(isTest).map(asImportStatement).join('');

    fs.writeFileSync(path.posix.join(this.outputPath, 'tests.js'), contents, { encoding: 'utf8' });
  }
}
