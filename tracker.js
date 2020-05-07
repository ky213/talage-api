/* eslint-disable */

/**
 * Print the current line and original function calling
 */

Object.defineProperty(global, '__stack', {'get': function(){
	const orig = Error.prepareStackTrace;
	Error.prepareStackTrace = function(_, stack){
		return stack;
	};
	const err = new Error();
	Error.captureStackTrace(err, arguments.callee);
	const stack = err.stack;
	Error.prepareStackTrace = orig;
	return stack;
}});

Object.defineProperty(global, '__line', {'get': function(){
	return __stack[1].getLineNumber();
}});

Object.defineProperty(global, '__function', {'get': function(){
	return arguments.callee.caller && arguments.callee.caller.name || '(anonymous)';
}});

Object.defineProperty(global, '__file', {'get': function(){
	return __stack[1].getFileName().split('/').slice(-1)[0].split('.').slice(0, -1).join('.');
}});

Object.defineProperty(global, '__location', {'get': function(){
	return `fileName: ${__stack[1].getFileName().split('/').slice(-1)[0].split('.').slice(0, -1).join('.')} lineNumber: ${__stack[1].getLineNumber()}`;
}});