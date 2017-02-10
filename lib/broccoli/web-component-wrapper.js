const fs = require('fs');
const glob = require('glob');
const find = require('broccoli-stew').find;
const merge = require('broccoli-merge-trees');
const CachingWriter = require('broccoli-caching-writer');
const defaultsDeep = require('ember-cli-lodash-subset').defaultsDeep;

const DEFAULT_OPTIONS = {
  annotation: "Web Component Wrapper"
};

const COMPONENT_GLOB = 'ui/components/*/component.js';

function wrapper(components) {
  components = JSON.stringify(components);
  return `export default ${components}`;
}

class WebComponentWrapper extends CachingWriter {
  constructor(inputNodes, options) {
    options = defaultsDeep(options, DEFAULT_OPTIONS);
    super(inputNodes, options);
  }

  build() {
    let components = [];

    this.inputPaths.forEach(inputPath => {
      let foundComponents = glob.sync(COMPONENT_GLOB, { cwd: inputPath });
      components = components.concat(foundComponents);
    });

    components = components.map(componentPath => {
      return componentPath.match(/\/([^/]+)\/component.js/)[1];
    });

    console.log("\n\n" + wrapper(components) + "\n\n");

    fs.writeFileSync(`${this.outputPath}/web-components.js`, wrapper(components));
  }
}

module.exports = function wrapWebComponents(inputNodes) {
  if (!Array.isArray(inputNodes)) {
    inputNodes = [inputNodes];
  } else {
    inputNodes = inputNodes.slice();
  }

  let tree = find(inputNodes, COMPONENT_GLOB);
  tree = new WebComponentWrapper([tree]);

  return tree;
}