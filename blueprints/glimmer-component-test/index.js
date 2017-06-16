'use strict';

const stringUtils = require('ember-cli-string-utils');
const validComponentName = require('ember-cli-valid-component-name');
const normalizeEntityName = require('ember-cli-normalize-entity-name');

module.exports = {
  description: 'Generates a component test. Name must contain a hyphen.',

  normalizeEntityName(entityName) {
    return validComponentName(normalizeEntityName(entityName));
  },

  fileMapTokens() {
    return {
      __name__(options) {
        return options.dasherizedModuleName;
      },
    };
  },

  locals(options) {
    let nameParts = options.entity.name.split('/');
    let componentName = nameParts[nameParts.length - 1];
    return { componentName };
  },
};
