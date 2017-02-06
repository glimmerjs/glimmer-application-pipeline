"use strict";

var defaultsDeep = require('ember-cli-lodash-subset').defaultsDeep;
var EmberApp = require('ember-cli/lib/broccoli/ember-app');
var ConfigLoader  = require('broccoli-config-loader');
var ConfigReplace = require('broccoli-config-replace');
var Funnel = require('broccoli-funnel');

var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var typescript = require('broccoli-typescript-compiler').typescript;
var concat = require('broccoli-concat');
var merge = require('broccoli-merge-trees');
var stew = require('broccoli-stew');
var compileSass = require('broccoli-sass');
var replace = require('broccoli-string-replace');
var mv = stew.mv;
var find = stew.find;
var map = stew.map;
var babel = require('broccoli-babel-transpiler');
var assetRev = require('broccoli-asset-rev');
var uglify = require('broccoli-uglify-sourcemap');

const ResolutionMapBuilder = require('@glimmer/resolution-map-builder');
var RollupWithDependencies = require('./rollup-with-dependencies');
var GlimmerTemplatePrecompiler = require('./glimmer-template-precompiler');

var DEFAULT_CONFIG = {
  configPath: './config/environment',
  trees: {
    app: 'src',
    styles: 'src/ui/styles'
  },
  jshintrc: {
    tests: 'tests',
    app: 'src'
  }
};

module.exports = GlimmerApp;

/**
 * GlimmerApp provides an interface to a package (app, engine, or addon)
 * compatible with the module unification layout.
 *
 * @class GlimmerApp
 * @extends EmberApp
 * @constructor
 * @param {Object} [defaults]
 * @param {Object} [options={}] Configuration options
 */
function GlimmerApp(defaults, options) {
  if (arguments.length === 0) {
    options = {};
  } else if (arguments.length === 1) {
    options = defaults;
  } else {
    defaultsDeep(options, defaults);
  }

  this.appConstructor(defaultsDeep(options, DEFAULT_CONFIG));
}

GlimmerApp.__proto__ = EmberApp;

GlimmerApp.prototype = Object.create(EmberApp.prototype);
GlimmerApp.prototype.constructor = GlimmerApp;
GlimmerApp.prototype.appConstructor = EmberApp.prototype.constructor;

GlimmerApp.prototype.toTree = function(options) {
  var projectDir = process.cwd();
  var projectFolder = this.projectFolder = (options && options.projectFolder || 'src');
  var srcDir = projectDir + '/' + projectFolder;

  console.log('Building app tree:', srcDir);

  if (process.env.EMBER_ENV !== 'production') {
    rimraf.sync('dist');
  }

  var tsOptions = {
    tsconfig: {
      compilerOptions: {
        target: "es5",
        module: "es2015",
        inlineSourceMap: true,
        inlineSources: true,
        moduleResolution: "node"
      },
      exclude: [
        'node_modules',
        '**/*.d.ts'
      ]
    }
  };

  var srcTree = find(srcDir, {
    destDir: 'src'
  });

  var tsBypassTree = find(srcTree, {
    include: ['**/*.js']
  });

  var nodeModules = find(path.join(projectDir, 'node_modules'), {
    destDir: 'node_modules'
  });

  var tsTree = merge([srcTree, nodeModules]);

  var compiledTS = typescript(tsTree, tsOptions);

  var appTree = merge([compiledTS, tsBypassTree]);

  var jsTree = find(appTree, {
    srcDir: 'src',
    exclude: ['config/**', '**/*.d.ts']
  });

  var hbsTree = find(projectDir, {
    include: ['src/**/*.hbs']
  });

  var resolvableTree = find([appTree, hbsTree], {
    srcDir: 'src',
    include: ['**/*.js', '**/*.hbs'],
    exclude: ['config/**']
  });

  var configEnvironment = find(appTree, {
    srcDir: 'src',
    include: ['config/environment.js']
  });

  var moduleMap = this.buildResolutionMap(resolvableTree, configEnvironment);

  configEnvironment = this.rewriteConfigEnvironment(configEnvironment);

  jsTree = merge([
    jsTree,
    moduleMap,
    configEnvironment
  ]);

  hbsTree = find(hbsTree, {
    srcDir: 'src'
  });

  hbsTree = new GlimmerTemplatePrecompiler(hbsTree, {
    rootName: this.project.pkg.name
  });

  jsTree = merge([jsTree,
                  hbsTree]);

  jsTree = new RollupWithDependencies(jsTree, {
    inputFiles: ['**/*.js'],
    rollup: {
      onwarn(message) {
        // Suppress known error message caused by TypeScript compiled code with Rollup
        // https://github.com/rollup/rollup/wiki/Troubleshooting#this-is-undefined
        if (/The \`this\` keyword is equivalent to \`undefined\` at the top level of an ES module, and has been rewritten/.test(message)) {
          return;
        }
        console.error(message);
      },
      entry: 'index.js',
      dest: 'app.js',
      sourceMap: 'inline'
    }
  });

  if (process.env.EMBER_ENV === 'production') {
    jsTree = uglify(jsTree, {
      compress: {
        screw_ie8: true,
      },
      sourceMapConfig: {
        enabled: false
      }
    });
  }

  var htmlTree = this.index();

  var cssTree = compileSass([srcDir + '/ui/styles'],
                            'app.scss', 'app.css');

  var appTree = merge([
    jsTree,
    htmlTree,
    cssTree,
    'public/'
  ]);

  if (process.env.EMBER_ENV === 'production') {
    var extensions = ['js'];
    var replaceExtensions = ['html', 'js'];

    if (!options.preventCssFingerPrinting) {
      extensions.push('css');
      replaceExtensions.push('css');
    }
    appTree = assetRev(appTree, {
      extensions: extensions,
      replaceExtensions: replaceExtensions
    });

    if (!options.disableCache) {
      var manifestTree = appcache(appTree, {
        cache: ['/'],
        network: ['*'],
        treeCacheEntryPathPrefix: options && options.prefix || null
      });

      appTree = merge([appTree, manifestTree]);
    }
  }

  return appTree;
}

GlimmerApp.prototype._configPath = function() {
  return path.join(this.name, 'config', 'environments', this.env + '.json');
}

GlimmerApp.prototype.rewriteConfigEnvironment = function(src) {
  return new ConfigReplace(src, this._configTree(), {
    configPath: this._configPath(),
    files: [ 'config/environment.js' ],
    patterns: this._configReplacePatterns()
  });
}

GlimmerApp.prototype.buildResolutionMap = function(src, config) {
  return new ResolutionMapBuilder(src, this._configTree(), {
    configPath: this._configPath()
  });
}

GlimmerApp.prototype.index = function() {
  var htmlName = this.options.outputPaths.app.html;
  var files = [
    'index.html'
  ];

  var index = new Funnel(this.trees.app + '/ui', {
    files: files,
    getDestinationPath: function(relativePath) {
      if (relativePath === 'index.html') {
        relativePath = htmlName;
      }
      return relativePath;
    },
    annotation: 'Funnel: index.html'
  });

  return new ConfigReplace(index, this._configTree(), {
    configPath: path.join(this.name, 'config', 'environments', this.env + '.json'),
    files: [ htmlName ],
    patterns: this._configReplacePatterns()
  });
};

GlimmerApp.prototype._configTree = function() {
  if (this._cachedConfigTree) {
    return this._cachedConfigTree;
  }

  var configPath = this.project.configPath();
  var configTree = new ConfigLoader(path.dirname(configPath), {
    env: this.env,
    tests: this.tests,
    project: this.project
  });

  this._cachedConfigTree = new Funnel(configTree, {
    srcDir: '/',
    destDir: this.name + '/config',
    annotation: 'Funnel (config)'
  });

  return this._cachedConfigTree;
}

function getNpmDependencies(projectPath) {
  return JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'))).dependencies;
}

function getBowerDependencies(projectPath) {
  return JSON.parse(fs.readFileSync(path.join(projectPath, 'bower.json'))).dependencies;
}
