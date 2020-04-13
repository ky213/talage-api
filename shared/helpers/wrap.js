/**
 * Middleware wrapper for route handlers
 */

'use strict';

module.exports = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
};