'use strict';

const stringUtils = require('ember-cli-string-utils');
const normalizeEntityName = require('ember-cli-normalize-entity-name');

module.exports = {
  description: 'Generates a helper function.',

  normalizeEntityName(entityName) {
    return normalizeEntityName(entityName);
  },

  fileMapTokens() {
    return {
      __name__(options) {
        return options.dasherizedModuleName;
      },
    };
  },

  locals(options) {
    let functionName = stringUtils.camelize(options.entity.name.replace(/\//g, '-'));
    return { functionName };
  },
};
