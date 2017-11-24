# glimmer-application-pipeline

[![npm version](https://badge.fury.io/js/%40glimmer%2Fapplication-pipeline.svg)](https://badge.fury.io/js/%40glimmer%2Fapplication-pipeline)
[![Build Status](https://secure.travis-ci.org/glimmerjs/glimmer-application-pipeline.svg?branch=master)](http://travis-ci.org/glimmerjs/glimmer-application-pipeline)

## Installation

Add this package to your project with Yarn:

```bash
yarn add @glimmer/application-pipeline
```

Or alternatively with npm:

```bash
npm install --save-dev @glimmer/application-pipeline
```

## Usage

This package exports a `GlimmerApp` class.
Using this class enables you to run your application code and assets through a broccoli pipeline, and calling `toTree()` will return a broccoli node with the processed files:

```javascript
const { GlimmerApp } = require('@glimmer/application-pipeline');

module.exports = function(defaults) {
  var app = new GlimmerApp(defaults, {
    // Add options here
  });

  return app.toTree();
};
```

### Importing CommonJS modules

The application pipeline only supports ES modules out of the box, but consumers can opt-in to using CommonJS modules themselves.
Here is an example of what this looks like:

```javascript
// ember-cli-build.js
const GlimmerApp = require('@glimmer/application-pipeline').GlimmerApp;
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');

module.exports = function(defaults) {
  let app = new GlimmerApp(defaults, {
    rollup: {
      plugins: [
        resolve({ jsnext: true, module: true, main: true }),
        commonjs()
      ]
    }
  });

  return app.toTree();
};
```

Note that Rollup must be [configured](https://github.com/rollup/rollup/wiki/JavaScript-API) when an NPM module rely on global variables. For example, if [`crypto`](https://developer.mozilla.org/en-US/docs/Web/API/Window/crypto) is being used by one of the modules that is `import`ed into the the app, the additional options to the above for the Rollup config is the following:

```js
rollup: {
  // ...
  external: ['crypto'],
  globals: {
    crypto: 'crypto'
  }
}
```

### Styles and SASS
When an application is generated with ember-cli's blueprint - `ember new my-app -b @glimmer/blueprint`, it installs ember-cli addon [ember-cli-sass](https://www.npmjs.com/package/ember-cli-sass) which also is used in EmberJS applications. So you can tune it via options for GlimmerApp in the same way as in EmberApp (see [details](https://ember-cli.com/user-guide/#scsssass)).

One of common requirements is to support imports (`@import`) from node_modules.
For example, we need to import 3rd-party SASS overriding its variable (that's because we can't just use compiled css).

```sass
$mdc-theme-accent: #00e871;

@import "../../../node_modules/material-components-web/material-components-web.scss";
```

By default we'll get an error on building:
```
Build failed.
The Broccoli Plugin: [BroccoliMergeTrees] failed with:
Error: File to import not found or unreadable: ../../../node_modules/material-components-web/material-components-web.scss.
```
To fix it we need to tell SASS compiler to look up in node_modules folder:
```js
module.exports = function(defaults) {
  let app = new GlimmerApp(defaults, {
    sassOptions: {
      includePaths: [
        'node_modules'
      ]
    }
});
```

### Customizing production and debug builds

This enables any dependencies that are being built to do the following:

```js
import { DEBUG } from '@glimmer/env';

if (DEBUG) {
  // do things that are supposed to be done in debug builds only
}
```

A good example of this, is to only install "mandatory setters" for `@tracked` when running in debug builds. In production we do not want to `Object.defineProperty(instance, propertyName, ...)` for **every** property that is used in a template, but we do want this in debug builds so that we can provide nice helpful messaging to the user about what they have potentially done wrong.

This PR also enables automatic `warn` / `assert` stripping via:

```js
import { assert } from '@glimmer/debug';

assert(somePredicateGoesHere, 'helpful message when the predicate is not true');
```

In debug build this is transpiled to something like:

```js
somePredicateGoesHere && console.assert(somePredicateGoesHere, 'helpful message when the predicate is not true');
```

But in production builds, the entire statement is removed.

## Enabling use of async-await in components

First, install `regenerator-runtime` in your app:

```bash
yarn add --dev regenerator-runtime
```

Then import `regenerator-runtime/runtime` at the top of `src/index.ts`:

```javascript
// src/index.ts
import 'regenerator-runtime/runtime';
```

## Development

For the development of this project, Yarn is preferred over npm. However, any Yarn command can be replaced by the npm equivalent.
See [Migration from npm](https://yarnpkg.com/lang/en/docs/migrating-from-npm/) in the Yarn documentation for a list of the equivalent commands.

* Clone repository locally: `git clone https://github.com/glimmerjs/glimmer-application-pipeline.git`
* Install dependencies: `yarn`, or `yarn install`
* Open project in your editor of choice and make your changes
* Run tests: `yarn run test`

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/glimmerjs/glimmer-application-pipeline.

## Acknowledgements

Thanks to [Monegraph](http://monegraph.com) for funding the initial development
of this library.

## License

MIT License.

