'use strict';

// Register global function to load shared modules
global.requireShared = function(moduleName) {
	return require(`${__dirname}/../shared/${moduleName}`);
};