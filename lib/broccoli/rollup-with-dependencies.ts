import * as Rollup from 'broccoli-rollup';
import * as nodeResolve from 'rollup-plugin-node-resolve';
import * as babel from 'rollup-plugin-babel';
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

    plugins.push(loadWithInlineMap());

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
      sourceMaps: 'inline',
      retainLines: false
    }));

    plugins.push(nodeResolve({
      jsnext: true,
      main: true
    }));

    this.rollupOptions.plugins = plugins;

    this.rollupOptions.onwarn = function(warning) {
      // Suppress known error message caused by TypeScript compiled code with Rollup
      // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
      if (warning.code === 'THIS_IS_UNDEFINED') {
        return;
      }
      console.log("Rollup warning: ", warning.message);
    };

    return Rollup.prototype.build.apply(this, args);
  }
}

let SOURCE_MAPPING_DATA_URL = '//# sourceMap';
SOURCE_MAPPING_DATA_URL += 'pingURL=data:application/json;base64,';

function loadWithInlineMap() {
  return {
    load: function (id) {
      if (id.indexOf('\0') > -1) { return; }

      var code = fs.readFileSync(id, 'utf8');
      var result = {
        code: code,
        map: null
      };
      var index = code.lastIndexOf(SOURCE_MAPPING_DATA_URL);
      if (index === -1) {
        return result;
      }
      result.code = code;
      result.map = parseSourceMap(code.slice(index + SOURCE_MAPPING_DATA_URL.length));
      return result;
    }
  };
}

function parseSourceMap(base64) {
  return JSON.parse(new Buffer(base64, 'base64').toString('utf8'));
}

export default RollupWithDependencies;
