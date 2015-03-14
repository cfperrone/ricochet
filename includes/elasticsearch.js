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
},
module.exports.search = function(_query, then) {
    client.search({
        index: es_index,
        type: es_type,
        q: _query,
        size: 100,
        fields: false
    }, function(error, response) {
        if (error) {
            conole.log("ES: " + error);
            then([]);
        }

        // Return an empty array on no results
        var hit_count = response.hits.total;
        if (hits == 0) {
            then([]);
        }

        // Collate the task_ids
        var hits = response.hits.hits,
            task_ids = [];
        hits.forEach(function(hit) {
            task_ids.push(hit._id);
        });

        then(task_ids);
    });
},
// Searches with a wildcard appended. This is best suited for fields that
// are marked as index: not_analyzed
module.exports.searchWildcard = function(_query, then) {
    module.exports.search(_query + '*', then);
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
    pingServer(function() {
        // Clear the autoflush timeout id if it exists
        autoflush = 0;

        var c = cache.splice(0, MAX_CACHE_SIZE);
        bulkPost(getDataForCache(c));
    }, function() {
        console.log("ES: Server unavailable");
        return;
    });
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
function pingServer(success, fail) {
    client.ping({
        requestTimeout: 1000
    }, function(err) {
        if (err) {
            fail();
        } else {
            success();
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
    return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre
    }
}
function registerAutoFlush() {
    if (autoflush > 0) {
        clearTimeout(autoflush);
    }
    autoflush = setTimeout(cacheFlush, CACHE_AUTO_FLUSH);
}
