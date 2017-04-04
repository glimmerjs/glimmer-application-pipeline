'use strict';

const broccoliTestHelper = require('broccoli-test-helper');
const buildOutput = broccoliTestHelper.buildOutput;
const createTempDir = broccoliTestHelper.createTempDir;

const MockCLI = require('ember-cli/tests/helpers/mock-cli');
const Project = require('ember-cli/lib/models/project');

const { stripIndent } = require('common-tags');

const GlimmerApp = require('../../src').GlimmerApp;

const expect = require('../helpers/chai').expect;

describe('glimmer-app', function() {
  let input;

  beforeEach(function() {
    return createTempDir().then(tempDir => (input = tempDir));
  });

  afterEach(function() {
    return input.dispose();
  });

  function createApp(options = {}) {
    let pkg = { name: 'glimmer-app-test' };

    let cli = new MockCLI();
    let project = new Project(input.path(), pkg, cli.ui, cli);

    return new GlimmerApp({
      project
    }, options);
  }

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
  });
});
