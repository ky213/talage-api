'use strict';

module.exports = {'rules': {'no-debug-statements': {'create': function(context){
	return {'MemberExpression': function(node){
		if(node.object.name === 'log' && node.property.name === 'debug'){
			context.report(node.property, 'Logger debug statements not allowed');
		}
	}};
}}}};