'use strict';

async function SocketQuotes(socket) {
	// Log that a user connected
	log.info(`${socket.id} - Socket.io connection created`);
	socket.emit('status', 'waiting');

	// Log that a user disconnected
	socket.on('disconnect', function (reason) {
		log.info(`${socket.id} - Socket.io disconnected (${reason})`);
	});

	// Listen for application data to be received
	socket.on('application', async function (data) {
		log.info('Application Received');

		// Attempt to parse the data
		socket.emit('status', 'processing');
		try {
			data = JSON.parse(data);
		} catch (error) {
			log.warn('Invalid JSON');
			socket.emit('status', 'error');
			socket.emit('message', 'Invalid JSON');
			return;
		}

		log.verbose(util.inspect(data, false, null));

		// Very basic validation
		if (!data.business || !Object.prototype.hasOwnProperty.call(data, 'id') || !data.policies) {
			log.warn('Some required data is missing');
			socket.emit('status', 'error');
			socket.emit('message', 'Invalid Application - Some required data is missing. Please check the documentation.');
			return;
		}

		// Load the application
		const application = new Application();
		let had_error = false;
		await application.load(data).catch(function (error) {
			had_error = true;
			socket.emit('status', 'error');
			socket.emit('message', error.message);
			log.warn(`Cannot Load Application: ${error.message}`);
			socket.disconnect();
		});
		if (had_error) {
			return;
		}

		// Validate
		await application.validate().catch(function (error) {
			had_error = true;
			socket.emit('status', 'error');
			socket.emit('message', error.message);
			log.warn(`Invalid Application: ${error.message}`);
			socket.disconnect();
		});
		if (had_error) {
			return;
		}

		// Check if Testing and Send Test Response
		if (application.test) {
			// Test Response
			await application.run_test().then(function (response) {
				// Determine how many quotes are being returned
				const num_quotes = response.quotes.length;

				// Emit the first quote right away
				socket.emit('quote', response.quotes[0]);

				// If there was only one quote, just stop
				if (num_quotes === 1) {
					socket.emit('status', 'done');
					socket.disconnect();
					return;
				}

				// Loop through all of the remaining quotes, sending them in random intervals between 1-3 seconds apart
				let quotes_sent = 1;
				for (let i = 1; i < num_quotes; i++) {
					setTimeout(function () { // eslint-disable-line no-loop-func
						socket.emit('quote', response.quotes[i]);
						quotes_sent++;

						// Check if all quotes have been sent, and if so, send done and disconnect
						if (quotes_sent === num_quotes) {
							socket.emit('status', 'done');
							socket.disconnect();
						}
					}, Math.floor(Math.random() * (3000 - 1000 + 1) + 1000) * i);
				}
			}).catch(function (error) {
				socket.emit('status', 'error');
				socket.emit('message', error.message);
				log.warn(error.message);
				socket.disconnect();
			});
			return;
		}

		// Send Non-Test Response
		await application.run_quotes(socket).catch(function (error) {
			socket.emit('status', 'error');
			socket.emit('message', error.message);
			log.warn(error.message);
			socket.disconnect();
		});
	});
}

exports.RegisterEndpoint = (basePath) => {
	console.log('adding quotes socket endpoint');
	ServerAddSocket('Quotes socket', basePath + '/quotes', SocketQuotes);
};