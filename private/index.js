'use strict';

// Register global function to load shared modules
global.sharedPath = require('path').join(__dirname, '..', 'shared');
global.requireShared = (moduleName) => require(`${sharedPath}/${moduleName}`);
