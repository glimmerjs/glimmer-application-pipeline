module.exports = function(config) {
  let moduleConfig = config.moduleConfiguration;

  let collectionMap = {};
  let collectionPaths = [];
  let collections = moduleConfig.collections;
  let collectionNames = Object.keys(collections);
  collectionNames.forEach(function(collectionName) {
    var collection = collections[collectionName];
    var fullPath = collectionName;
    if (collection.group) {
      fullPath = collection.group + '/' + fullPath;
    }
    collectionPaths.push(fullPath);
    collectionMap[fullPath] = collectionName;
  });

  moduleConfig.collectionMap = collectionMap;
  moduleConfig.collectionPaths = collectionPaths;

  // console.log('moduleConfig', moduleConfig);

  return moduleConfig;
};
