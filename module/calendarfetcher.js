/*jshint node: true */
'use strict';

/* Magic Mirror NFC
 * Node Helper: GoogleCalendar - CalendarFetcher
 *
 * By Luís Gomes
 * MIT Licensed.
 *
 * Updated by @asbjorn
 * - rewrote to follow the nodejs samples from Google Calendar API

 * Updated by @0xUKN
 * - Added the NFC code to login to the Google Calendar API
 * - Rewrote/simplified parts of the code
 */

var moment = require('moment'),
    NFCTokenManager = require('./NFCTokenManager'),
    fs = require('fs'),
    readline = require('readline'),
    {google} = require('googleapis');

var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'],
    CALENDAR_IDS = ['primary'],
    CONFIG_DIR = __dirname + '/config/',
    GOOGLE_API_CONFIG_PATH = CONFIG_DIR + 'credentials.json'

var CalendarFetcher = function(calendarName, reloadInterval, maximumEntries, maximumNumberOfDays) {
    var self = this;
    var nfctokenmanager = new NFCTokenManager();  
    nfctokenmanager.Run();

    var reloadTimer = null;
    var events = [];

    var fetchFailedCallback = function() {};
    var eventsReceivedCallback = function() {};


    /* fetchCalendar()
     * Initiates calendar fetch.
     */
    var fetchCalendar = function(){
	var oAuth2Client;
	try {
		const content = fs.readFileSync(GOOGLE_API_CONFIG_PATH);         // Load client secrets from a local file.
		oAuth2Client = authorize(JSON.parse(content));
        } catch (err) {
            	console.log('[CalendarFetcher] Error loading client secret file:', err);
            	return;
        }

	nfctokenmanager.on('UPDATE_TOKEN', function (token) {
		console.log("[CalendarFetcher] Fetching calendar events... Token : ", token);
		if(token.length != 0) { 
			console.log("[CalendarFetcher] Token : logging in !");
			setNewToken(oAuth2Client, token); 
			listEvents(oAuth2Client);
		} 
		else { 
			console.log("[CalendarFetcher] No token : resetting !");
			reset_calendar(); 
			fetchFailedCallback(self, "No token");
		}
        });

    };


    /* isFullDayEvent(event)
     * Checks if an event is a fullday event.
     *
     * argument event obejct - The event object to check.
     *
     * return bool - The event is a fullday event.
     */
    var isFullDayEvent = function(event) {
        if (event.start.date)
            return true;

        var start = event.start.dateTime || 0;
        var startDate = new Date(start);
        var end = event.end.dateTime || 0;

        if (end - start === 24 * 60 * 60 * 1000 && startDate.getHours() === 0 && startDate.getMinutes() === 0) {
            // Is 24 hours, and starts on the middle of the night.
            return true;
        }

        return false;
    };

    /**
     * Create an OAuth2 client with the given credential
     *
     * @param {Object} credentials The authorization client credentials.
     */
    var authorize = function(credentials) {
        const {client_secret, client_id, redirect_uris} = credentials.installed;
        return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    };

    /**
     * Reset events list
     */
    var reset_calendar = function() {
        events = [];
	self.broadcastEvents();
    };

    /**
     * Create and returns a Promise object that retrieves, filters and properly
     * packs the Google Calendar events.
     *
     * @param {integer} calendar_id ID of the google calendar to retrieve
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    var createCalendarPromise = function(calendar_id, auth) {
        const calendar = google.calendar({version: 'v3', auth});
        console.log("[CalendarFetcher] Calendar ID: " + calendar_id);

        return new Promise(function cb(resolve, reject) {
            calendar.events.list({
                calendarId: calendar_id,
                timeMin: (new Date()).toISOString(),
                maxResults: maximumEntries,
                singleEvents: true,
                orderBy: 'startTime',
            }, (err, {data}) => {
                // Error handling
                if (err) {
		    console.log('[CalendarFetcher] The API returned an error: ' + err);
                    reject(err);
		    return;
                } else {
		        let calendar_events = data.items;
		        if (calendar_events.length) {
		            calendar_events.map((event, i) => {
		                let start = event.start.dateTime || event.start.date;
		                let today = moment().startOf('day').toDate();
		                let future = moment().startOf('day').add(maximumNumberOfDays, 'days').subtract(1,'seconds').toDate(); // Subtract 1 second so that events that start on the middle of the night will not repeat.
		                let skip_me = false;

		                let title = '';
		                let fullDayEvent = false;
		                let startDate = undefined;
		                let endDate = undefined;

		                // console.log("[CalendarFetcher] event.kind: " + event.kind);
		                if (event.kind === 'calendar#event') {
		                    startDate = moment(new Date(event.start.dateTime || event.start.date));
		                    endDate = moment(new Date(event.end.dateTime || event.end.date));

		                    if (event.start.length === 8) {
		                        startDate = startDate.startOf('day');
		                    }

		                    title = event.summary || event.description || 'Event';
		                    fullDayEvent = isFullDayEvent(event);
		                    if (!fullDayEvent && endDate < new Date()) {
		                        console.log("[CalendarFetcher] It's not a fullday event, and it is in the past. So skip: " + title);
		                        skip_me = true;
		                    }
		                    if (fullDayEvent && endDate <= today) {
		                        console.log("[CalendarFetcher] It's a fullday event, and it is before today. So skip: " + title);
		                        skip_me = true;
		                    }

		                    if (startDate > future) {
		                        console.log("[CalendarFetcher] It exceeds the maximumNumberOfDays limit. So skip: " + title);
		                        skip_me = true;
		                    }
		                } else {
		                    console.log("[CalendarFetcher] Other kind of event: ", event);
		                }

		                if (!skip_me) {
		                    // Every thing is good. Add it to the list.
		                    console.log("[CalendarFetcher] Adding: " + title);
		                    events.push({
		                        title: title,
		                        startDate: startDate.format('x'),
		                        endDate: endDate.format('x'),
		                        fullDayEvent: fullDayEvent
		                    });
		                }
		            });
		        } else {
		            console.log('[CalendarFetcher] No upcoming events found.');
		        }
		        console.log("[CalendarFetcher] Resolve / good()");
		        resolve();
		}
            });
        });
    };

    /**
     * Loops over a set of configurable calendarId's and fetch the events.
     *
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    var listEvents = function(auth) {
        let promises = [];
        for (let i=0; i < CALENDAR_IDS.length; i++) {
            promises.push(createCalendarPromise(CALENDAR_IDS[i], auth));
        }

        // Will only run after all Promises are complete
        Promise.all(promises).then(function(results) {
            let newEvents = events;
            // Just for console debugging
            newEvents.map((event, i) => {
                let start = event.startDate;
                console.log(`#${i}: ${start} - ${event.summary}`);
            });

            // Sort the combination of events from all calendars
            newEvents.sort(function(a, b) {
                return a.startDate - b.startDate;
            });

            // Update 'global' events array
            events = newEvents.slice(0, maximumEntries);

            // Broadcast event
            self.broadcastEvents();
        }).catch(function(err) {
            // Error handling goes here
            console.log("[CalendarFetcher] Getting error from Promise : " + err);
	    reset_calendar();
            fetchFailedCallback(self, err);
        });
    };

    /**
     * Set new token obtained from NFC.
     * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
     * @param {token} token The new token
     */
    var setNewToken = function(oAuth2Client, token) {
        console.log("[CalendarFetcher] Getting new token for googlecalendar");
	var new_token = {"access_token":token, "token_type": 'Bearer'};
        oAuth2Client.setCredentials(new_token); 
    };

    /* public methods */

    /* startFetch()
     * Initiate fetchCalendar();
     */
    this.startFetch = function() {
        fetchCalendar();
    };

    /* broadcastItems()
     * Broadcast the existing events.
     */
    this.broadcastEvents = function() {
        //console.log('[CalendarFetcher] Broadcasting ' + events.length + ' events.');
        eventsReceivedCallback(self);
    };

    /* onReceive(callback)
     * Sets the on success callback
     *
     * argument callback function - The on success callback.
     */
    this.onReceive = function(callback) {
        eventsReceivedCallback = callback;
    };

    /* onError(callback)
     * Sets the on error callback
     *
     * argument callback function - The on error callback.
     */
    this.onError = function(callback) {
        fetchFailedCallback = callback;
    };

    /* url()
     * Returns the calendar name of this fetcher.
     *
     * return string - The calendar name of this fetcher.
     */
    this.name = function() {
        return calendarName;
    };

    /* events()
     * Returns current available events for this fetcher.
     *
     * return array - The current available events for this fetcher.
     */
    this.events = function() {
        return events;
    };

};

module.exports = CalendarFetcher;

