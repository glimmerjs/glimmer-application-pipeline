'use strict';

const fs = require('fs');
const path = require('path');
const walkSync = require('walk-sync');
import CachingWriterPlugin = require("broccoli-caching-writer");
import { Tree } from "broccoli";

export interface TestEntrypointBuilderOptions {
  annotation?: string;
}

export default class TestEntrypointBuilder extends CachingWriterPlugin {
  constructor(testTree: Tree, public options: TestEntrypointBuilderOptions = {}) {
    super([testTree], {
      annotation: options['annotation']
    });
  }

  build() {
    let testDir = this.inputPaths[0];
    let testFiles = walkSync(testDir);

    function isTest({ name }: { name: string }) { return name.match(/\-test$/); }
    function asImportStatement({ dir, name }: { dir: string, name: string }) {
      let testDirRelativePath = `./${path.join(dir, name)}`;
      return `import '${testDirRelativePath}';\n`;
    }

    let contents = testFiles.map(path.parse).filter(isTest).map(asImportStatement).join('');

    fs.writeFileSync(path.posix.join(this.outputPath, 'tests.js'), contents, { encoding: 'utf8' });
  }
}
