'use strict';

import { buildOutput, createTempDir, TempDir } from 'broccoli-test-helper';

import GlimmerTemplatePrecompiler, {
  getTemplateSpecifier
} from '../../lib/broccoli/glimmer-template-precompiler';

const expect = require('../helpers/chai').expect;

describe('glimmer-template-precompiler', function() {
  let input: TempDir;

  beforeEach(function() {
    return createTempDir().then(tempDir => (input = tempDir));
  });

  afterEach(function() {
    return input.dispose();
  });

  describe('basic broccoli functionality', function() {
    class MockTemplatePrecompiler extends GlimmerTemplatePrecompiler {
      precompile(content) {
        return content.toUpperCase();
      }
    }

    it('emits the precompiler as a default export', async function() {
      input.write({
        'ui': {
          'components': {
            'foo-bar.hbs': '"some template here"'
          }
        }
      });

      let templateCompiler = new MockTemplatePrecompiler(input.path(), { rootName: 'foo-bar-app' });
      let output = await buildOutput(templateCompiler);

      expect(output.read()).to.deep.equal({
        'ui': {
          'components': {
            'foo-bar.ts': 'export default "SOME TEMPLATE HERE";'
          }
        }
      });
    });
  });

  describe('getTemplateSpecifier', function() {
    const rootName = 'some-root-name';

    const cases = [
      ['ui/components/foo-bar/template.hbs', 'template:/some-root-name/components/foo-bar']
    ];

    cases.forEach(function(parts) {
      let input = parts[0];
      let expected = parts[1];

      it(input, function() {
        expect(getTemplateSpecifier(rootName, input)).to.equal(expected);
      })
    });
  });
});
