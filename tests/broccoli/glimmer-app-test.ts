'use strict';

const path = require('path');

import { buildOutput, createTempDir, TempDir } from 'broccoli-test-helper';

const MockCLI = require('ember-cli/tests/helpers/mock-cli');
const Project = require('ember-cli/lib/models/project');

const { stripIndent } = require('common-tags');

import GlimmerApp, {
  GlimmerAppOptions
} from '../../lib/broccoli/glimmer-app';

const expect = require('../helpers/chai').expect;

describe('glimmer-app', function() {
  let input: TempDir;

  beforeEach(function() {
    return createTempDir().then(tempDir => (input = tempDir));
  });

  afterEach(function() {
    return input.dispose();
  });

  function createApp(options: GlimmerAppOptions = {}) {
    let pkg = { name: 'glimmer-app-test' };

    let cli = new MockCLI();
    let project = new Project(input.path(), pkg, cli.ui, cli);

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
      const ORIGINAL_EMBER_ENV = process.env.EMBER_ENV;

      beforeEach(function() {
        delete process.env.EMBER_ENV;
      });

      afterEach(function() {
        process.env.EMBER_ENV = ORIGINAL_EMBER_ENV;
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
    it('allows passing custom `src` tree');

    it('returns null when no styles are present', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'index.html': 'src',
          },
        },
        'config': {},
      });

      let app = createApp() as any;
      let output = app.cssTree();

      expect(output).to.be.undefined;
    });

    it('compiles sass', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
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

      let app = createApp() as any;
      let output = await buildOutput(app.cssTree());

      expect(output.read()).to.deep.equal({
        'app.css': `body {\n  font: 100% Helvetica, sans-serif;\n  color: #333; }\n`,
      });
    });

    it('handles colocated styles', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'components': {
              'test-component': {
                'style.scss': stripIndent`
                  $font-stack: Helvetica, sans-serif;
                  $primary-color: #333;

                  body { font: 100% $font-stack; color: $primary-color; }
                `,
              }
            },
          }
        },
        'config': {},
      });

      let app = createApp({
        styleConfig: {
          colocation: true
        }
      }) as any;
      let output = await buildOutput(app.cssTree());

      expect(output.read()).to.deep.equal({
        'app.css': `body {\n  font: 100% Helvetica, sans-serif;\n  color: #333; }\n`,
      });
    });

    it('passes through css', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'styles': {
              'app.css': `body { color: #333; }`
            },
          }
        },
        'config': {},
      });

      let app = createApp() as any;
      let output = await buildOutput(app.cssTree());

      expect(output.read()).to.deep.equal({
        'app.css': `body {\n  color: #333; }\n`
      });
    });

    it('respects outputPaths.app.css with plain css', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
            'styles': {
              'app.css': `body { color: #333; }`
            },
          }
        },
        'config': {},
      });

      let app = createApp({
        outputPaths: {
          app: {
            css: 'foo-bar.css'
          }
        }
      }) as any;
      let output = await buildOutput(app.cssTree());

      expect(output.read()).to.deep.equal({
        'foo-bar.css': `body {\n  color: #333; }\n`
      });
    });

    it('respects outputPaths.app.css with sass', async function () {
      input.write({
        'app': {},
        'src': {
          'ui': {
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
        outputPaths: {
          app: {
            css: 'foo-bar.css'
          }
        }
      }) as any;
      let output = await buildOutput(app.cssTree());

      expect(output.read()).to.deep.equal({
        'foo-bar.css': `body {\n  font: 100% Helvetica, sans-serif;\n  color: #333; }\n`,
      });
    });
  });

  describe('toTree', function() {
    this.timeout(10000);

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

    it('builds a module map', async function() {
      input.write({
        'src': {
          'index.ts': 'import moduleMap from "./config/module-map"; console.log(moduleMap);',
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
      expect(actual['app.js']).to.include('component:/glimmer-app-test/components/foo-bar');
    });

    it('includes resolver config', async function() {
      input.write({
        'src': {
          'index.ts': 'import resolverConfig from "./config/resolver-configuration"; console.log(resolverConfig);',
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
  });
});
