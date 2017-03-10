import * as Rollup from 'broccoli-rollup';
import * as nodeResolve from 'rollup-plugin-node-resolve';
import * as babel from 'rollup-plugin-babel';
import * as sourcemaps from 'rollup-plugin-sourcemaps';
import * as fs from 'fs';
import * as path from 'path';

class RollupWithDependencies extends Rollup {
  rollupOptions: any;
  inputPaths: any[];

  constructor(inputNode, options) {
    super(...arguments)
  }

  build(...args) {
    let plugins = this.rollupOptions.plugins || [];
    let inputPath = this.inputPaths[0];

    plugins.push(sourcemaps());

    plugins.push(babel({
      presets: [
        [
          'es2015',
          { modules: false }
        ]
      ],
      plugins: [
        'external-helpers'
      ],
      // TODO sourceMaps: 'inline',
      retainLines: true
    }));

    plugins.push({
      resolveId(importee, importer) {
        let modulePath = path.join(inputPath, importee, 'index.js');

        if (fs.existsSync(modulePath)) {
          return modulePath;
        }

        modulePath = path.join(inputPath, importee + '.js');
        if (fs.existsSync(modulePath)) {
          return modulePath;
        }
      }
    });

    plugins.push(nodeResolve({
      jsnext: true,
      main: true
    }));

    this.rollupOptions.plugins = plugins;

    return Rollup.prototype.build.apply(this, args);
  }
}

export default RollupWithDependencies;
