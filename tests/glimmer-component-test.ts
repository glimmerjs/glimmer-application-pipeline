'use strict';

import {
  setupTestHooks,
  expect,
  emberNew,
  emberGenerate,
  emberGenerateDestroy
} from './helpers/helpers';


describe('Acceptance: ember generate and destroy glimmer-component', function() {
  setupTestHooks(this);

  // testing that this is failing doesn't work properly at the moment
  it.skip('glimmer-component foo', function () {
    let args = ['glimmer-component', 'foo'];

    return emberNew().then(() => {
      return expect(emberGenerate(args)).to.be.rejected;
    });
  });

  it('glimmer-component FooBar', function () {
    let args = ['glimmer-component', 'FooBar'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/FooBar/component.ts'))
          .to.contain(`import Component from '@glimmer/component';`)
          .to.contain(`export default class FooBar extends Component {`);

        expect(file('src/ui/components/FooBar/template.hbs'))
          .to.contain(`<div></div>`);

        expect(file('src/ui/components/FooBar/component.js')).to.not.exist;
        expect(file('src/ui/components/FooBar/helper.ts')).to.not.exist;
      }));
  });

  it('glimmer-component foo/bar/X-Baz', function () {
    let args = ['glimmer-component', 'foo/bar/X-Baz'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/foo/bar/X-Baz/component.ts'))
          .to.contain(`import Component from '@glimmer/component';`)
          .to.contain(`export default class XBaz extends Component {`);

        expect(file('src/ui/components/foo/bar/X-Baz/template.hbs'))
          .to.contain(`<div></div>`);

        expect(file('src/ui/components/foo/bar/X-Baz/component.js')).to.not.exist;
        expect(file('src/ui/components/foo/bar/X-Baz/helper.ts')).to.not.exist;
      }));
  });

  it('glimmer-component X-Foo/X-Bar/X-Baz', function () {
    let args = ['glimmer-component', 'X-Foo/X-Bar/X-Baz'];

    return emberNew()
      .then(() => emberGenerateDestroy(args, (file) => {
        expect(file('src/ui/components/X-Foo/X-Bar/X-Baz/component.ts'))
          .to.contain(`import Component from '@glimmer/component';`)
          .to.contain(`export default class XBaz extends Component {`);

        expect(file('src/ui/components/X-Foo/X-Bar/X-Baz/template.hbs'))
          .to.contain(`<div></div>`);

        expect(file('src/ui/components/X-Foo/X-Bar/X-Baz/component.js')).to.not.exist;
        expect(file('src/ui/components/X-Foo/X-Bar/X-Baz/helper.ts')).to.not.exist;
      }));
  });
});
