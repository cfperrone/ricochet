var express = require('express'),
    lame = require('lame'),
    fs = require('fs'),
    jade = require('jade'),
    file = require('file'),
    path = require('path'),
    id3 = require('id3js'),
    crypto = require('crypto'),
    Sequelize = require('sequelize'),
    execFile = require('child_process').execFile;
var app = express(),
    db = new Sequelize('ricochet', 'stream', 'lolwat'),
    valid_extensions = [ '.mp3', '.wav', '.m4a', '.ogg' ];

// -- Database Configuration
var Track = db.define('track', {
    id: Sequelize.STRING(255),
    filename: Sequelize.STRING(1024),
    title: Sequelize.STRING(255),
    artist: Sequelize.STRING(255),
    album: Sequelize.STRING(255),
    genre: Sequelize.STRING(255),
    track_num: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    track_total: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    disc_num: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    disc_total: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    play_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    }
}, {
    timestamps: true,
    createdAt: 'create_date',
    updatedAt: 'update_date',
    underscored: true,
    freezeTableName: true,
});

// -- Stream Configuration
var library_path = '/home/cperrone/music/';

// -- Setup Express
app.use(express.static(__dirname + '/static/'));
app.use(express.bodyParser());
app.set('views', __dirname + '/templates/');
app.set('view engine', 'jade');

// -- Express endpoints
app.get('/', function(req, res) {
    Track.findAll({
        order: 'album ASC, track_num ASC, title ASC'
    })
    .success(function(tracks) {
        res.render('index', {
            pageTitle: 'Ricochet',
            library: tracks
        });
    });
});
app.get('/play/:id', function(req, res) {
    req.connection.setTimeout(750000); // 15 minutes

    // Look up the track to get its filename
    var id = req.params['id'];
    Track.find({
        where: {
            id: id
        }
    })
    .success(function(track) {
        try {
            fs.readFile(track.filename, function(err, data) {
                if (err) throw err;
                res.type('audio/mpeg');
                res.send(data);
            });
        } catch (e) {
            console.log('Could not find file ' + track.filename);
        }
    })
    .error(function(err) {
        console.log('Could not find file in index with id ' + id);
    });
});
app.post('/play/:id/:action', function(req, res) {
    var id = req.params['id'],
        action = req.params['action'];
    Track.find({
        where: {
            id: id
        }
    })
    .success(function(track) {
        if (action == 'increment') {
            track.play_count++;
            track.save()
            .success(function(track) {
                res.render('row', {
                    track: track
                });
            });

        }
    })
    .error(function(err) {
        console.log('Could not find file in index with id ' + id);
    });
});
app.post('/server/reindex', function(req, res) {
    // Reindex the server
    updateIndex();
    res.send("OK");
});

// Sync the db schema
db.sync()
.success(function() {
    // Index the library
    updateIndex();
});
// Start the server
app.listen(8081);

// -- Indexes the music library
function updateIndex() {
    // Use `find` to get a list of all files recursively in library_path
    execFile('find', [ library_path, '-type', 'f' ], function(err, stdout, stderr) {
        var file_list = stdout.split('\n');
        file_list.pop(); // removes current dir from file_list
        file_list.forEach(function(filename, i) {
            console.log("Indexing " + filename);

            // bail if we've found an invalid extension
            var extension = path.extname(filename).toLowerCase();
            if (valid_extensions.indexOf(extension) < 0) {
                console.log("Invalid extension \"" + extension + "\" found");
                return;
            }

            var fd = fs.createReadStream(filename);
            var id = crypto.createHash('md5').update(filename).digest('hex');

            // Get id3 tags
            id3({ file: filename, type: id3.OPEN_LOCAL }, function (err, tags) {
                if (err) {
                    console.log(err);
                    return;
                }

                // Start building a model of metadata
                var track_data = {
                    filename: filename,
                    title: tags.title,
                    artist: tags.artist,
                    album: tags.album,
                    genre: tags.genre,
                };
                // Get additional info from helper functions
                track_data = getTrackNumbers(track_data, tags);
                track_data = getAlternateTitle(track_data, tags);

                // Check if the index already exists, otherwise create it
                Track.findOrCreate({ id: id }, track_data)
                .success(function(track, created) {
                    if (created) {
                        console.log("Created " + track.title);
                    } else {
                        console.log("Indexed " + track.title);
                    }
                })
                .error(function(err) {
                    console.log(err);
                });
            });
        });
    });
}

// -- Indexer helper functions
function getTrackNumbers(data, tags) {
    data.track_num = 0;
    data.track_total = 0;
    data.disc_num = 0;
    data.disc_total = 0;

    var filetrack = path.basename(data.filename).match(/^(\d+) .*/);
    var v1track = tags.v1.track;
    var v2track = tags.v2.track;
    var v2disc = tags.v2.disc;

    // Check the filename first
    if (filetrack != null && filetrack.length > 1) {
        data.track_num = parseInt(filetrack[1]);
    }
    if (v1track != null) {
        data.track_num = parseInt(v1track);
    }
    if (v2track != null) {
        var parts = v2track.split('/');
        data.track_num = parseInt(parts[0]);
        if (parts.length > 1) {
            data.track_total = parseInt(parts[1]);
        }
    }
    if (v2disc != null) {
        var parts = v2disc.split('/');
        data.disc_num = parseInt(parts[0]);
        if (parts.length > 1) {
            data.disc_total = parseInt(parts[1]);
        }
    }

    return data;
}
function getAlternateTitle(data, tags) {
    if (data.title != null) {
        return data;
    }

    var filetitle = path.basename(data.filename).match(/^\d+ (.*)\..*/);
    if (filetitle != null && filetitle.length > 1) {
        data.title = filetitle[1];
    }

    return data;
}

