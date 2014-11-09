var es = require('elasticsearch');

var MAX_CACHE_SIZE = 50,
    CACHE_AUTO_FLUSH = 3000; // in milliseconds

var cache = [],
    es_host, es_index, es_type,
    client = null,
    autoflush = 0;

// Constructor
module.exports = function(_host, _index, _type) {
    es_host = _host; es_index = _index; es_type = _type;
    client = new es.Client({
        host: es_host,
        log: 'error'
    });

    return module.exports;
},

// Register a single track for indexing
module.exports.index = function(track) {
    cachePush(track);
},

// Flush the cache to index
module.exports.flush = function() {
    cacheFlush();
}

// -- Local Functions
function cachePush(track) {
    cache.push(track);

    // Flush the cache if we've reached the threshold
    if (cache.length >= MAX_CACHE_SIZE) {
        cacheFlush();
    } else {
        registerAutoFlush();
    }
}

function cacheFlush() {
    // Clear the autoflush timeout id if it exists
    autoflush = 0;

    bulkPost(getDataForCache(cache));
    cache = [];
}

function bulkPost(data) {
    // Prevent caching empty data
    if (data.length == 0) {
        return;
    }

    client.bulk({
        body: data
    }, function(err, resp) {
        if (!err) {
            var count = resp.items.length;
            console.log("ES: Indexed " + count + " tracks in Elasticsearch");
        } else {
            console.log("ES: " + err);
        }
    });
}

// -- Helpers
function getDataForCache(c) {
    var output = [];
    c.forEach(function(track) {
        output.push(getActionArrayForTrack(track));
        output.push(getTrackData(track));
    });
    return output;
}
function getActionArrayForTrack(track) {
    return {
        index: {
            _index: es_index,
            _type: es_type,
            _id: track.id
        }
    }
}
function getTrackData(track) {
    return track.values;
}
function registerAutoFlush() {
    if (autoflush > 0) {
        clearTimeout(autoflush);
    }
    autoflush = setTimeout(cacheFlush, CACHE_AUTO_FLUSH);
}
