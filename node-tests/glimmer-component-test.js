'use strict';

let blueprintHelpers = require('ember-cli-blueprint-test-helpers/helpers');
let setupTestHooks = blueprintHelpers.setupTestHooks;
let emberNew = blueprintHelpers.emberNew;
let emberGenerate = blueprintHelpers.emberGenerate;
let emberGenerateDestroy = blueprintHelpers.emberGenerateDestroy;

let expect = require('ember-cli-blueprint-test-helpers/chai').expect;

describe('Acceptance: ember generate and destroy glimmer-component', function() {
  setupTestHooks(this);

  // testing that this is failing doesn't work properly at the moment
  it.skip('glimmer-component foo', function () {
    let args = ['glimmer-component', 'foo'];

    return emberNew().then(() => {
      return expect(emberGenerate(args)).to.be.rejected;
    });
  });

  it('glimmer-component foo-bar', function () {
    let args = ['glimmer-component', 'foo-bar'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/foo-bar/component.ts'))
          .to.contain(`import Component from '@glimmer/component';`)
          .to.contain(`export default class FooBar extends Component {`);

        expect(file('src/ui/components/foo-bar/template.hbs'))
          .to.contain(`<div></div>`);

        expect(file('src/ui/components/foo-bar/component.js')).to.not.exist;
        expect(file('src/ui/components/foo-bar/helper.ts')).to.not.exist;
      }));
  });

  it('glimmer-component foo/bar/x-baz', function () {
    let args = ['glimmer-component', 'foo/bar/x-baz'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/foo/bar/x-baz/component.ts'))
          .to.contain(`import Component from '@glimmer/component';`)
          .to.contain(`export default class FooBarXBaz extends Component {`);

        expect(file('src/ui/components/foo/bar/x-baz/template.hbs'))
          .to.contain(`<div></div>`);

        expect(file('src/ui/components/foo/bar/x-baz/component.js')).to.not.exist;
        expect(file('src/ui/components/foo/bar/x-baz/helper.ts')).to.not.exist;
      }));
  });
});
