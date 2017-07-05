'use strict';

const path = require('path');

import { buildOutput, createTempDir, TempDir } from 'broccoli-test-helper';

const MockCLI = require('ember-cli/tests/helpers/mock-cli');
const Project = require('ember-cli/lib/models/project');
const stew = require('broccoli-stew');

const { stripIndent } = require('common-tags');

import GlimmerApp from '../../lib/broccoli/glimmer-app';
import { GlimmerAppOptions } from '../../lib/interfaces';

const expect = require('../helpers/chai').expect;

describe('glimmer-app', function() {
  this.timeout(15000);

  let input: TempDir;

  const ORIGINAL_EMBER_ENV = process.env.EMBER_ENV;

  beforeEach(function() {
    return createTempDir().then(tempDir => (input = tempDir));
  });

  afterEach(function() {
    if (ORIGINAL_EMBER_ENV) {
      process.env.EMBER_ENV = ORIGINAL_EMBER_ENV;
    } else {
      delete process.env.EMBER_ENV;
    }

    return input.dispose();
  });

  function createApp(options: GlimmerAppOptions = {}, addons = []): GlimmerApp {
    let pkg = { name: 'glimmer-app-test' };

    let cli = new MockCLI();
    let project = new Project(input.path(), pkg, cli.ui, cli);
    project.initializeAddons();
    project.addons = project.addons.concat(addons);

    return new GlimmerApp({
      project
    }, options);
  }

  describe('constructor', function() {
    it('throws an error if no arguments are provided', function() {
      expect(() => {
        const AnyGlimmerApp = GlimmerApp as any;
        new AnyGlimmerApp();
      }).to.throw(/must pass through the default arguments/)
    });

    it('throws an error if project is not passed through', function() {
      expect(() => {
        const AnyGlimmerApp = GlimmerApp as any;
        new AnyGlimmerApp({});
      }).to.throw(/must pass through the default arguments/)
    });

    describe('env', function() {
      beforeEach(function() {
        delete process.env.EMBER_ENV;
      });

      it('sets an `env`', function() {
        let app = createApp();

        expect(app.env).to.be.defined;
      })

      it('sets an `env` to `development` if process.env.EMBER_ENV is undefined', function() {
        let app = createApp();

        expect(app.env).to.equal('development');
      })

      it('sets an `env` to process.env.EMBER_ENV if present', function() {
        process.env.EMBER_ENV = 'test';

        let app = createApp();

        expect(app.env).to.equal('test');
      })
    })
  });

  describe('buildTree', function() {
    it('invokes preprocessTree on addons that are present', async function() {
      input.write({
        'src': {
          'ui': {
            'index.html': 'src',
          },
        },
        'config': {},
      });

      let app = createApp({}, [
        {
          name: 'awesome-reverser',
          preprocessTree(type, tree) {
            return stew.map(tree, (contents) => contents.split('').reverse().join(''));
          }
        }
      ]);

      let output = await buildOutput(app['trees'].src);

      expect(output.read()).to.deep.equal({
        'src': {
          'ui': {
            'index.html': 'crs',
          }
        }
      });
    });
  });

  describe('htmlTree', function() {
    it('emits index.html', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'index.html': 'src',
          },
        },
        'config': {},
      });

      let app = createApp();
      let output = await buildOutput(app.htmlTree());

      expect(output.read()).to.deep.equal({
        'index.html': 'src',
      });
    });

    it('updates rootURL from config', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'index.html': stripIndent`
              <body>
               <head>
                 <script src="{{rootURL}}bar.js"></script>
               </head>
              </body>`,
          },
        },
        'config': {
          'environment.js': `
            module.exports = function() {
              return { rootURL: '/foo/' };
            };`
        },
      });

      let app = createApp() as any;
      let output = await buildOutput(app.htmlTree());

      expect(output.read()).to.deep.equal({
        'index.html': stripIndent`
              <body>
               <head>
                 <script src="/foo/bar.js"></script>
               </head>
              </body>`
      });
    });

    it('allows passing custom `src` tree', async function () {
      input.write({
        'app': {},
        'derp': {
          'ui': {
            'index.html': 'derp'
          }
        },
        'src': {
          'ui': {
            'index.html': 'src',
          },
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          src: 'derp'
        }
      }) as any;

      let output = await buildOutput(app.htmlTree());

      expect(output.read()).to.deep.equal({
        'index.html': 'derp',
      });
    });

    it('allows passing custom outputPaths', async function() {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'index.html': 'src',
          },
        },
        'config': {},
      });

      let app = createApp({
        outputPaths: {
          app: { html: 'foo.html' }
        }
      }) as any;

      let output = await buildOutput(app.htmlTree());

      expect(output.read()).to.deep.equal({
        'foo.html': 'src',
      });
    });
  });

  describe('cssTree', function() {
    it('allows passing custom `styles` tree', async function () {
      input.write({
        'app': {},
        'derp': {
          'ui': {
            'styles': {
              'app.css': 'derp'
            }
          }
        },
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': 'src'
          },
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          styles: 'derp/ui/styles',
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      }) as any;

      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['app.css']).to.equal('derp');
    });

    it('does not generate app.css without styles', async function () {
      input.write({
        'app': {},
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': 'src',
          },
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      }) as any;
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['app.css']).to.be.undefined;
    });

    it('compiles sass', async function () {
      input.write({
        'app': {},
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': '',
            'styles': {
              'app.scss': stripIndent`
                $font-stack: Helvetica, sans-serif;
                $primary-color: #333;

                body { font: 100% $font-stack; color: $primary-color; }
              `,
            },
          }
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      }) as any;
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['app.css']).to.equal(
        `body {\n  font: 100% Helvetica, sans-serif;\n  color: #333; }\n`
      );
    });

    it('passes through css', async function () {
      input.write({
        'app': {},
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': '',
            'styles': {
              'app.css': `body { color: #333; }`
            },
          }
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      }) as any;
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['app.css']).to.equal(`body { color: #333; }`);
    });

    it('respects outputPaths.app.css with plain css', async function () {
      input.write({
        'app': {},
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': '',
            'styles': {
              'app.css': `body { color: #333; }`
            },
          }
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        },
        outputPaths: {
          app: {
            css: 'foo-bar.css'
          }
        }
      }) as any;
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['foo-bar.css']).to.equal(`body { color: #333; }`);
    });

    it('respects outputPaths.app.css with sass', async function () {
      input.write({
        'app': {},
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': '',
            'styles': {
              'app.scss': stripIndent`
                $font-stack: Helvetica, sans-serif;
                $primary-color: #333;

                body { font: 100% $font-stack; color: $primary-color; }
              `,
            },
          }
        },
        'config': {},
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        },
        outputPaths: {
          app: {
            css: 'foo-bar.css'
          }
        }
      }) as any;
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['foo-bar.css']).to.equal(
        `body {\n  font: 100% Helvetica, sans-serif;\n  color: #333; }\n`
      );
    });
  });

  describe('toTree', function() {

    const tsconfigContents = stripIndent`
      {
        "compilerOptions": {
          "target": "es6",
          "module": "es2015",
          "inlineSourceMap": true,
          "inlineSources": true,
          "moduleResolution": "node",
          "experimentalDecorators": true
        },
        "exclude": [
          "node_modules",
          "tmp",
          "dist"
        ]
      }
    `;

    it('transpiles templates', async function() {
      input.write({
        'src': {
          'index.ts': 'import template from "./ui/components/foo-bar"; console.log(template);',
          'ui': {
            'index.html': 'src',
            'components': {
              'foo-bar.hbs': `<div>Hello!</div>`
            },
          }
        },
        'config': {},
        'tsconfig.json': tsconfigContents
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      });
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['index.html']).to.equal('src');
      expect(actual['app.js']).to.include('Hello!');
    });

    describe('allows userland babel plugins', function() {
      function reverser () {
        return {
          name: "ast-transform",
          visitor: {
            StringLiteral(path) {
              path.node.value = path.node.value.split('').reverse().join('');
            }
          }
        };
      }

      it('runs user-land plugins', async function() {
        input.write({
          'src': {
            'index.ts': 'console.log(\'olleh\');',
            'ui': {
              'index.html': 'src'
            }
          },
          'config': {},
          'tsconfig.json': tsconfigContents
        });

        let app = createApp({
          babel: {
            plugins: [
              [reverser]
            ]
          },
          trees: {
            nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
          }
        });
        let output = await buildOutput(app.toTree());
        let actual = output.read();

        expect(actual['index.html']).to.equal('src');
        expect(actual['app.js']).to.include('hello');
      });
    });

    describe('babel-plugin-debug-macros', function() {
      it('replaces @glimmer/env imports', async function() {
        input.write({
          'src': {
            'index.ts': 'import { DEBUG } from "@glimmer/env"; console.log(DEBUG);',
            'ui': {
              'index.html': 'src'
            }
          },
          'config': {},
          'tsconfig.json': tsconfigContents
        });

        let app = createApp({
          trees: {
            nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
          }
        });
        let output = await buildOutput(app.toTree());
        let actual = output.read();

        expect(actual['index.html']).to.equal('src');
        expect(actual['app.js']).to.include('console.log(true)');
      });

      it('rewrites @glimmer/debug imports', async function() {
        input.write({
          'src': {
            'index.ts': 'import { assert } from "@glimmer/debug"; assert(true, "some message for debug");',
            'ui': {
              'index.html': 'src'
            }
          },
          'config': {},
          'tsconfig.json': tsconfigContents
        });

        let app = createApp({
          trees: {
            nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
          }
        });
        let output = await buildOutput(app.toTree());
        let actual = output.read();

        expect(actual['index.html']).to.equal('src');
        expect(actual['app.js']).to.include('true && console.assert(true');
      });

      it('removes @glimmer/debug imports in production builds', async function() {
        process.env.EMBER_ENV = 'production';

        input.write({
          'src': {
            'index.ts': 'import { assert } from "@glimmer/debug"; assert(true, "some message for debug");',
            'ui': {
              'index.html': 'src'
            }
          },
          'config': {},
          'tsconfig.json': tsconfigContents
        });

        let app = createApp({
          trees: {
            nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
          }
        });
        let output = await buildOutput(app.toTree());
        let actual = output.read();

        expect(actual['index.html']).to.equal('src');

        let outputFiles = Object.keys(actual);
        let appFile = outputFiles.find(fileName => fileName.startsWith('app'));

        expect(actual[appFile]).to.include('false && console.assert(true');
      });
    });

    it('builds a module map', async function() {
      input.write({
        'src': {
          'index.ts': 'import moduleMap from "../config/module-map"; console.log(moduleMap);',
          'ui': {
            'index.html': 'src',
            'components': {
              'foo-bar.hbs': `<div>Hello!</div>`
            },
          }
        },
        'config': {},
        'tsconfig.json': tsconfigContents
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      });
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['index.html']).to.equal('src');
      expect(actual['app.js']).to.include('template:/glimmer-app-test/components/foo-bar');
    });

    it('includes resolver config', async function() {
      input.write({
        'src': {
          'index.ts': 'import resolverConfig from "../config/resolver-configuration"; console.log(resolverConfig);',
          'ui': {
            'index.html': 'src'
          }
        },
        'config': {},
        'tsconfig.json': tsconfigContents
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        }
      });
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      // it would be much better to confirm the full expected resolver config
      // but rollup actually reformats the code so it doesn't match a simple
      // JSON.stringify'ied version of the defaultModuleConfiguration
      expect(actual['app.js']).to.include('glimmer-app-test');
      expect(actual['app.js']).to.include('definitiveCollection');
    });

    it('honors outputPaths.app.js', async function() {
      input.write({
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': 'src'
          }
        },
        'config': {},
        'tsconfig.json': tsconfigContents
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        },
        outputPaths: {
          app: {
            js: 'foo-bar-file.js'
          }
        }
      });
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['foo-bar-file.js']).to.be.defined;
    });

    it('allows specifying rollup options', async function() {
      input.write({
        'src': {
          'index.ts': 'console.log("NOW YOU SEE ME");',
          'ui': {
            'index.html': 'src'
          }
        },
        'config': {},
        'tsconfig.json': tsconfigContents
      });

      let app = createApp({
        trees: {
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        },
        rollup: {
          plugins: [
            {
              name: 'test-replacement',
              transform(code, id) {
                return code.replace('NOW YOU SEE ME', 'NOW YOU DON\'T');
              }
            }
          ]
        }
      });

      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['app.js']).to.include('NOW YOU DON\'T');
    });

    it('allows passing custom Broccoli nodes', async function() {
      input.write({
        'src': {
          'index.ts': '',
          'ui': {
            'index.html': 'src'
          }
        },
        'config': {},
        'tsconfig.json': tsconfigContents
      });

      let app = createApp({
        trees: {
          src: stew.log(path.join(input.path(), 'src')),
          nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
        },
      });
      let output = await buildOutput(app.toTree());
      let actual = output.read();

      expect(actual['app.js']).to.be.defined;
    });

    describe('`getGlimmerEnvironment`', () => {
      it('returns application options from `config/environment.js` if it is specified via `GlimmerENV`', () => {
        input.write({
          'app': {},
          'src': {
            'ui': {
              'index.html': 'src',
            },
          },
          'config': {
            'environment.js': `
            module.exports = function() {
              return { GlimmerENV: { FEATURES: {} } };
            };`
          },
        });
        let app = createApp();

        expect(app.getGlimmerEnvironment()).to.deep.equal({ FEATURES: {} });
      });

      it('returns application options from `config/environment.js` if it is specified via `EmberENV`', () => {
        input.write({
          'app': {},
          'src': {
            'ui': {
              'index.html': 'src',
            },
          },
          'config': {
            'environment.js': `
            module.exports = function() {
              return { EmberENV: { FEATURES: {} } };
            };`
          },
        });
        let app = createApp();

        expect(app.getGlimmerEnvironment()).to.deep.equal({ FEATURES: {} });
      });
    });
  });
});
