'use strict';

const stringUtils = require('ember-cli-string-utils');
const SilentError = require('silent-error');

function capitalize(name) {
  return name[0].toUpperCase() + name.slice(1);
};

function validComponentName(entityName) {
  let parts = entityName.split('/');
  let name = parts[parts.length - 1];

  let firstCharacter = name[0];
  if(firstCharacter !== firstCharacter.toUpperCase()) {
    throw new SilentError("Component name must be capitalized");
  }

  return entityName;
};

function getComponentLocals(entityName) {
  let nameParts = entityName.split('/');
  let baseName = nameParts[nameParts.length - 1];
  let componentName = capitalize(baseName);
  let className = stringUtils.classify(baseName);

  nameParts.pop();
  nameParts.push(componentName);
  let moduleName = nameParts.join('/');

  return { componentName, className, moduleName };
};

module.exports = {
  capitalize,
  validComponentName,
  getComponentLocals
};
