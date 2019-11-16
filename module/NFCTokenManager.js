/* Google Calendar NFC
 * By 0xUKN
 * Based on https://github.com/santigimeno/node-pcsclite
 */

// Imports
const PCSC = require('pcsclite');
const EventEmitter = require('events')

// Timers
const validity_milliseconds = 30 * 1000;
const refresh_milliseconds = 1 * 1000

// Communication protocol details
const A_OKAY = "\x90\x00"
const A_NOT_OKAY = "\x90\x01"
const A_REMAINING = "\x90\x02"
const APDU_SELECT_AID = [0x00, 0xa4, 0x04, 0x00, 0x07, 0xf0, 0x39, 0x41, 0x48, 0x14, 0x81, 0x00, 0x00]

/**
* Read a token from a reader object (needs several messages to get the full token)
*
* @param {Object} reader The reader to use
* @param {Object} self Context to use
* @param {Object} protocol Protocol used
*/
function getDataFromReader(reader, self, protocol) {
	if(self.isComplete) { // We are getting brand new data from scratch
		reader.transmit(Buffer.from(APDU_SELECT_AID.concat(0)), 50, protocol, function(err, data) {
			if (err) {
				console.log(err);
			} else {
				console.log('[NFCLink] Data received', data);
				var output = data.toString('binary');
				if (output.length > 2 && output.slice(-2) == A_OKAY) {
					console.log("[NFCLink] End token transfer !");
					if(self.isComplete) { self.token = output.slice(0, -2).replace(/\x00/g,''); }
					else { self.token += output.slice(0, -2).replace(/\x00/g,''); }
					self.token_hour = new Date().getTime() + validity_milliseconds;
					self.isComplete = true;
					self.emit('UPDATE_TOKEN', self.token);
				} else if(output.length > 2 && output.slice(-2) == A_REMAINING) {
					console.log("[NFCLink] Token transfer ...");
					if(self.isComplete) { self.token = output.slice(0, -2); }
					else { self.token += output.slice(0, -2); }
					self.token_hour = new Date().getTime() + validity_milliseconds;
					self.isComplete = false;
					getDataFromReader(reader, self, protocol);
				} else {
					console.log("[NFCLink] Unknown data !");
					self.token = "";
					self.token_hour = new Date().getTime() + validity_milliseconds;
					self.isComplete = false;
					self.emit('UPDATE_TOKEN', self.token);
				}
			}
		});
	} else { // We are continuing old transaction
		reader.transmit(Buffer.from(APDU_SELECT_AID.concat(self.token.length)), 50, protocol, function(err, data) {
			if (err) {
				console.log(err);
			} else {
				console.log('[NFCLink] Data received', data);
				var output = data.toString('binary');
				if (output.length > 2 && output.slice(-2) == A_OKAY) {
					console.log("[NFCLink] End token transfer !");
					if(self.isComplete) { self.token = output.slice(0, -2).replace(/\x00/g,''); }
					else { self.token += output.slice(0, -2).replace(/\x00/g,''); }
					self.token_hour = new Date().getTime() + validity_milliseconds;
					self.isComplete = true;
					self.emit('UPDATE_TOKEN', self.token);
				} else if(output.length > 2 && output.slice(-2) == A_REMAINING) {
					console.log("[NFCLink] Token transfer ...");
					if(self.isComplete) { self.token = output.slice(0, -2); }
					else { self.token += output.slice(0, -2); }
					self.token_hour = new Date().getTime() + validity_milliseconds;
					self.isComplete = false;
					getDataFromReader(reader, self, protocol);
				} else {
					console.log("[NFCLink] Unknown data !");
					self.token = "";
					self.token_hour = new Date().getTime() + validity_milliseconds;
					self.isComplete = false;
					self.emit('UPDATE_TOKEN', self.token);
				}
			}
		});
	}
}

// Main class
class NFCTokenManager extends EventEmitter {
	// Constructor
	constructor() {
		super(); //construct EventEmitter
		this.token = "";
		this.token_hour = new Date().getTime() + validity_milliseconds;

		// Check if token is outdated every x seconds
		setInterval(function() {
			if(new Date().getTime() > this.token_hour) {
				this.token = "";
				this.isComplete = false;
				this.token_hour = new Date().getTime() + validity_milliseconds; 
				this.emit('UPDATE_TOKEN', this.token)
			}
		}.bind(this), refresh_milliseconds);  
	}

	// Run function : run the PCSC library to handle NFC reader
	Run() {
		var pcsc = PCSC();
		var self = this;
		console.log("[NFCLink] Waiting for an NFC reader ...");

		// Set up callbacks
		pcsc.on('reader', function(reader) {
    			console.log('[NFCLink] New reader detected', reader.name);

			reader.on('error', function(err) {
				console.log('[NFCLink] Error(', this.name, '):', err.message);
			});

			reader.on('status', function(status) {
				//console.log('[NFCLink] Status(', this.name, '):', status);
				/* check what has changed */
				var changes = this.state ^ status.state;
				if (changes) {
					if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
						console.log("[NFCLink] Card removed"); // Card removed

						reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
							if (err) {
								console.log(err);
							} else {
								console.log('[NFCLink] Disconnected\n\n');
							}
						});
					} else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
						console.log("[NFCLink] Card inserted"); // Card inserted
						reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
							if (err) {
								console.log(err);
							} else {
								console.log('[NFCLink] Protocol(', reader.name, '):', protocol);
								getDataFromReader(reader, self, protocol);
							}
						});
					}
				}
			});

			reader.on('end', function() {
				console.log('[NFCLink] Reader',  this.name, 'removed');       
			});
		});

		pcsc.on('error', function(err) {
			console.log('[NFCLink] PCSC error', err.message);
		});
	}
}

// Initialize module
module.exports = NFCTokenManager;



