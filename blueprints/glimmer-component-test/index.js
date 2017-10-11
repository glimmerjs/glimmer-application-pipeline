'use strict';

const helpers = require('../helpers');

module.exports = {
  description: 'Generates a component test. Name must be capitalized.',

  normalizeEntityName(entityName) {
    return helpers.validComponentName(entityName);
  },

  fileMapTokens() {
    return {
      __name__(options) {
        return options.locals.moduleName;
      },
    };
  },

  locals(options) {
    return helpers.getComponentLocals(options.entity.name);
  },
};
