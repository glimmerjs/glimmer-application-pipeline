'use strict';

let blueprintHelpers = require('ember-cli-blueprint-test-helpers/helpers');
let setupTestHooks = blueprintHelpers.setupTestHooks;
let emberNew = blueprintHelpers.emberNew;
let emberGenerateDestroy = blueprintHelpers.emberGenerateDestroy;

let expect = require('ember-cli-blueprint-test-helpers/chai').expect;

describe('Acceptance: ember generate and destroy glimmer-helper', function() {
  setupTestHooks(this);

  it('glimmer-helper foo', function () {
    let args = ['glimmer-helper', 'foo'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/foo/helper.ts'))
          .to.contain(`export default function foo(params) {`);

        expect(file('src/ui/components/foo/helper.js')).to.not.exist;
        expect(file('src/ui/components/foo/template.hbs')).to.not.exist;
        expect(file('src/ui/components/foo/component.ts')).to.not.exist;
      }));
  });

  it('glimmer-helper foo-bar', function () {
    let args = ['glimmer-helper', 'foo-bar'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/foo-bar/helper.ts'))
          .to.contain(`export default function fooBar(params) {`);

        expect(file('src/ui/components/foo-bar/helper.js')).to.not.exist;
        expect(file('src/ui/components/foo-bar/template.hbs')).to.not.exist;
        expect(file('src/ui/components/foo-bar/component.ts')).to.not.exist;
      }));
  });

  it('glimmer-helper foo/bar/baz', function () {
    let args = ['glimmer-helper', 'foo/bar/baz'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/foo/bar/baz/helper.ts'))
          .to.contain(`export default function baz(params) {`);

        expect(file('src/ui/components/foo/bar/baz/helper.js')).to.not.exist;
        expect(file('src/ui/components/foo/bar/baz/template.hbs')).to.not.exist;
        expect(file('src/ui/components/foo/bar/baz/component.ts')).to.not.exist;
      }));
  });
});
