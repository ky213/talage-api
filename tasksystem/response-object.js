exports.success = {
	success: true,
	message: 'request succeeded'
}

exports.errorQueueWaitTimeout = {
	success: false,
	message: 'timeout waiting for new message'
}

exports.error = function(message) {
	return {
		success: false,
		message: message
	}
}
