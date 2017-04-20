# glimmer-application-pipeline

[![npm version](https://badge.fury.io/js/%40glimmer%2Fapplication-pipeline.svg)](https://badge.fury.io/js/%40glimmer%2Fapplication-pipeline)
[![Build Status](https://secure.travis-ci.org/glimmerjs/glimmer-application-pipeline.svg?branch=master)](http://travis-ci.org/glimmerjs/glimmer-application-pipeline)

## Instalation

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

