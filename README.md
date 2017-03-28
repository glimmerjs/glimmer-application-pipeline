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

