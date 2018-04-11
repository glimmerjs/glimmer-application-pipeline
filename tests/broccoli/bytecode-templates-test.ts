import { AST, ASTPlugin } from "@glimmer/syntax";

import GlimmerApp from '../../lib/broccoli/glimmer-app';
import { GlimmerAppOptions } from '../../lib/interfaces';
import { buildOutput, createTempDir, TempDir } from 'broccoli-test-helper';
import path = require('path');
import { readFileSync } from 'fs';
import * as SimpleDOM from 'simple-dom';

const { expect } = require('../helpers/chai');
const MockCLI = require('ember-cli/tests/helpers/mock-cli');
const Project = require('ember-cli/lib/models/project');
const { stripIndent } = require('common-tags');

class TestGlimmerApp extends GlimmerApp {
  public getRegistry() { return this.registry; }
}

describe('Bytecode Template Compilation', function() {
  this.timeout(20000);

  let input: TempDir;
  const pkg = {
    name: 'glimmer-app-test',
    version: '0.1.0'
  };

  beforeEach(function() {
    return createTempDir().then(tempDir => (input = tempDir));
  });

  function createApp(options: GlimmerAppOptions = {}, addons: any[] = []): TestGlimmerApp {
    let cli = new MockCLI();
    let project = new Project(input.path(), pkg, cli.ui, cli);
    project.initializeAddons();
    project.addons = project.addons.concat(addons);

    return new TestGlimmerApp({
      project
    }, options);
  }

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

  const indexTsContents = stripIndent`
    import Application, { BytecodeLoader, DOMBuilder, SyncRenderer } from '@glimmer/application';
    import { ComponentManager, setPropertyDidChange } from '@glimmer/component';
    import Resolver, { BasicModuleRegistry } from '@glimmer/resolver';
    import resolverConfiguration from '../config/resolver-configuration';
    import data from './data-segment';

    exports = function(bytecode, document) {
      const moduleRegistry = new BasicModuleRegistry(data.meta);
      const resolver = new Resolver(resolverConfiguration, moduleRegistry);

      const app = new Application({
        document,
        builder: new DOMBuilder({ element: document.body, nextSibling: null }),
        loader: new BytecodeLoader({ bytecode, data }),
        renderer: new SyncRenderer(),
        resolver,
        rootName: resolverConfiguration.app.rootName
      });

      app.registerInitializer({
        initialize(registry) {
          registry.register(\`component-manager:/\${app.rootName}/component-managers/main\`, ComponentManager);
        }
      });

      return app;
    };
  `

  it('produces functional bytecode output', async function() {
    input.write({
      'package.json': JSON.stringify(pkg),
      'config': {
        'resolver-configuration.d.ts': `declare var _default: any; export default _default;`
      },
      'src': {
        'index.ts': indexTsContents,
        'data-segment.d.ts': `declare var _default: any; export default _default;`,
        'ui': {
          'index.html': 'src',
          'components': {
            'App': {
              'template.hbs': `<div>Hello!</div>`,
              'component.ts': `import Component from "@glimmer/component"; export default class extends Component { };`
            }
          }
        }
      },
      'tsconfig.json': tsconfigContents
    });

    let app = createApp({
      templateFormat: 'bytecode',
      trees: {
        nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
      }
    });

    let output = await buildOutput(app.toTree());
    let actual = output.read();

    let bytecode = readFileAsArrayBuffer(output.path('templates.gbx'));
    let buildApp = evalModule(actual['app.js'] as string);

    let doc = new SimpleDOM.Document();
    let glimmerApp = buildApp(bytecode, doc);

    glimmerApp.renderComponent('App', doc.body, null);
    await glimmerApp.boot();

    let serializer = new SimpleDOM.HTMLSerializer(SimpleDOM.voidMap);
    let html = serializer.serializeChildren(doc.body as any).trim();
    expect(html).to.equal('<div>Hello!</div><!---->');
  });

  it('applies `glimmer-ast-plugin`s discovered in the app registry', async function () {
    input.write({
      'package.json': JSON.stringify(pkg),
      'config': {
        'resolver-configuration.d.ts': `declare var _default: any; export default _default;`
      },
      'src': {
        'index.ts': indexTsContents,
        'data-segment.d.ts': `declare var _default: any; export default _default;`,
        'ui': {
          'index.html': 'src',
          'components': {
            'App': {
              'template.hbs': `<div>Hello!</div>`,
              'component.ts': `import Component from "@glimmer/component"; export default class extends Component { };`
            }
          }
        }
      },
      'tsconfig.json': tsconfigContents
    });

    let app = createApp({
      templateFormat: 'bytecode',
      trees: {
        nodeModules: path.join(__dirname, '..', '..', '..', 'node_modules')
      }
    });

    app.getRegistry().add('glimmer-ast-plugin', function(): ASTPlugin{
      return {
        name: 'test-plugin',
        visitor: {
          ElementNode(node: AST.ElementNode) {
            node.tag = 'span';
          }
        }
      }
    });

    let output = await buildOutput(app.toTree());
    let actual = output.read();

    let bytecode = readFileAsArrayBuffer(output.path('templates.gbx'));
    let buildApp = evalModule(actual['app.js'] as string);

    let doc = new SimpleDOM.Document();
    let glimmerApp = buildApp(bytecode, doc);

    glimmerApp.renderComponent('App', doc.body, null);
    await glimmerApp.boot();

    let serializer = new SimpleDOM.HTMLSerializer(SimpleDOM.voidMap);
    let html = serializer.serializeChildren(doc.body as any).trim();
    expect(html).to.equal('<span>Hello!</span><!---->');

  });
});

/**
 * Reads a file and converts the returned Node buffer into an ArrayBuffer.
 */
function readFileAsArrayBuffer(filePath: string) {
  let nodeBuffer = readFileSync(filePath);
  let arrayBuf = new ArrayBuffer(nodeBuffer.length);
  let bytes = new Uint8Array(arrayBuf);
  bytes.set(nodeBuffer);

  return arrayBuf;
}

function evalModule(source: string): any {
  const wrapper = `(function(exports) { ${source}; return exports; })`;
  const func = eval(wrapper);
  const moduleExports = func({});

  return moduleExports;
}