var request = require('request'),
    qs = require('querystring'),
    moment = require('moment'),
    crypto = require('crypto');

var app, db, config;

var API_URL = 'https://ws.audioscrobbler.com/2.0/?format=json';

module.exports = function(a, d, c) {
    app = a; db = d; config = c;

    return module.exports;
},
module.exports.nowPlaying = function(track, user) {
    if (!user.lastfm_scrobble || user.lastfm_session == '') {
        return;
    }

    var params = {
        api_key: config.lastfm_key,
        sk: user.lastfm_session,
        method: 'track.updateNowPlaying',
        artist: track.artist,
        track: track.title,
        album: track.album,
        trackNumber: track.track_num,
    };
    request.post({
        url: API_URL,
        form: qs.stringify(module.exports.getLastFMParams(params)),
    }, function(err, response, body) {
        var obj = JSON.parse(body),
            error = obj.error;

            if (!error) {
                console.log("LastFM: Marked as now playing, track " + track.id + " - " + track.title);
            } else {
                console.log("LastFM Error: " + obj.message);
            }
    });
},
module.exports.scrobble = function(track, user, elapsed) {
    var timestamp = moment().subtract(elapsed, 'seconds').format('X');

    if (user.lastfm_scrobble == false ||
        user.lastfm_session == '') {
        return;
    }

    // Get a LastFM session
    var params = {
        api_key: config.lastfm_key,
        sk: user.lastfm_session,
        timestamp: timestamp,
        method: 'track.scrobble',
        artist: track.artist,
        track: track.title,
        album: track.album,
        trackNumber: track.track_num,
    };
    request.post({
        url: API_URL,
        form: qs.stringify(module.exports.getLastFMParams(params)),
    }, function(err, response, body) {
        var obj = JSON.parse(body),
            error = obj.error;

        if (!error) {
            console.log("LastFM: Scrobbled track " + track.id + " - " + track.title);
        } else {
            console.log("LastFM: Error: " + obj.message);
        }
    });
},
module.exports.getSession = function(user, token, then) {
    var params = {
        api_key: config.lastfm_key,
        token: token,
        method: 'auth.getSession',
    };
    request.get({
        url: API_URL + '&' + qs.stringify(module.exports.getLastFMParams(params)),
    }, function(err, response, body) {
        var obj = JSON.parse(body),
            error = obj.error;

        if (error) {
            console.log("LastFM Error: " + obj.message);
            then();
            return;
        }

        // Save the LastFM session data
        var lastfm_username = obj.session.name,
            lastfm_session = obj.session.key;
        user.lastfm_user = lastfm_username;
        user.lastfm_session = lastfm_session;
        user.lastfm_scrobble = true;
        user.save()
        .success(function() {
            then();
        });
    });
},
module.exports.destroySession = function(user, then) {
    user.lastfm_user = '';
    user.lastfm_session = '';
    user.lastfm_scrobble = false;
    user.save()
    .success(function() {
        then();
    });
};


module.exports.getLastFMParams = function(params) {
    params.api_sig = getLastFMSignature(params);
    return params;
}
function getLastFMSignature(params) {
    var sig = "",
        keys = Object.keys(params).sort();

    keys.forEach(function(k) {
        if (params.hasOwnProperty(k)) {
            sig = sig + k + params[k];
        }
    });
    return crypto.createHash('md5').update(sig + config.lastfm_secret).digest('hex');
}
