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
    let nameParts = options.entity.name.split('/');
    let baseName = nameParts[nameParts.length - 1];
    let functionName = stringUtils.camelize(baseName);
    return { functionName };
  },
};
