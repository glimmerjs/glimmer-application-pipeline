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

```
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

## Enabling use of async-await in components

To get async/await to work, first you must create your project with the `--web-component option`, or add `@glimmer/web-component` to your package.json if your project has already been generated. 

Next, install `regerator-runtime` and `rollup-plugin-commonjs` in your app:

```bash
yarn add --dev regenerator-runtime
yarn add --dev rollup-plugin-commonjs
```

Import `regenerator-runtime` at the top of `src/index.ts`:

```javascript
// src/index.ts
import 'regenerator-runtime';
```

Enable commonJS modules in in ember-cli-build.js. Require `rollup-plugin-commonjs` and add `commonJS` to the rollup plugins:

```javascript
// ember-cli-build.js
const GlimmerApp = require('@glimmer/application-pipeline').GlimmerApp;
const commonjs = require('rollup-plugin-commonjs');

module.exports = function(defaults) {
  let app = new GlimmerApp(defaults, {
    rollup: {
      plugins: [
        commonjs()
      ]
    }
  });

  return app.toTree();
};
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

