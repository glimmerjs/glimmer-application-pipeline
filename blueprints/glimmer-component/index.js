'use strict';

const stringUtils = require('ember-cli-string-utils');
const validComponentName = require('ember-cli-valid-component-name');
const normalizeEntityName = require('ember-cli-normalize-entity-name');

module.exports = {
  description: 'Generates a component. Name must contain a hyphen.',

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
    let className = `${stringUtils.classify(options.entity.name)}Component`;
    return { className };
  },
};
