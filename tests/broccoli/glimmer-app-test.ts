'use strict';

const broccoliTestHelper = require('broccoli-test-helper');
const buildOutput = broccoliTestHelper.buildOutput;
const createTempDir = broccoliTestHelper.createTempDir;

const MockCLI = require('ember-cli/tests/helpers/mock-cli');
const Project = require('ember-cli/lib/models/project');

const { stripIndent } = require('common-tags');

import GlimmerApp, { GlimmerAppOptions } from '../../lib/broccoli/glimmer-app';

const expect = require('../helpers/chai').expect;

describe('glimmer-app', function() {
  let input;

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

      let app = createApp();
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
  });

  describe('cssTree', function() {
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
        'app.css': `body { color: #333; }`
      });
    });
  });
});
