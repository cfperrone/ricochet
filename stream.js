var express = require('express'),
    lame = require('lame'),
    fs = require('fs'),
    jade = require('jade'),
    file = require('file'),
    path = require('path'),
    mm = require('musicmetadata'),
    crypto = require('crypto'),
    moment = require('moment'),
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
    duration: {
        type: Sequelize.INTEGER,
        default_value: 0,
    },
    artist: {
        type: Sequelize.STRING(255),
        default_value: '',
    },
    album: {
        type: Sequelize.STRING(255),
        default_value: '',
    },
    genre: {
        type: Sequelize.STRING(255),
        default_value: '',
    },
    year: {
        type: Sequelize.STRING(16),
        default_value: '',
    },
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
    instanceMethods: {
        getDuration: function() {
            var m = moment().seconds(this.duration);
            if (this.duration > 3599) {
                return m.format('H:mm:ss');
            } else {
                return m.format('m:ss');
            }
        },
        // Enhances the db instance in preparation of presentation
        hydrate: function() {
            // Add a pretty duration string
            this.durationString = this.getDuration();

            return this;
        }
    },
    classMethods: {
        hydrateMultiple: function(tracks) {
            for (var i = 0; i < tracks.length; i++) {
                tracks[i] = tracks[i].hydrate();
            }
            return tracks;
        }
    }
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
        tracks = Track.hydrateMultiple(tracks);

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
        where: { id: id }
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
app.get('/play/:id/:action', function(req, res) {
    var id = req.params['id'],
        action = req.params['action'];
    Track.find({
        where: { id: id }
    })
    .success(function(track) {
        if (action == 'data') {
            res.json(track.hydrate());
        }
    });
});
app.post('/play/:id/:action', function(req, res) {
    var id = req.params['id'],
        action = req.params['action'];
    Track.find({
        where: { id: id }
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
        } else if (action == 'edit') {
            track.title = req.body['title'];
            track.artist = req.body['artist'];
            track.album = req.body['album'];
            track.genre = req.body['genre'];
            track.year = req.body['year'];
            track.track_num = req.body['track_num'];
            track.track_total = req.body['track_total'];
            track.disc_num = req.body['disc_num'];
            track.disc_total = req.body['disc_total'];
            console.log("Updating track with new title " + track.title);
            track.save()
            .success(function(t) {
                res.render('row', {
                    track: t
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

            var id = crypto.createHash('md5').update(filename).digest('hex');
            var parser = mm(fs.createReadStream(filename), { duration: true });

            // Get id3 tags
            //id3({ file: filename, type: id3.OPEN_LOCAL }, function (err, tags) {
            parser.on('metadata', function(tags) {
                // Start building a model of metadata
                var track_data = {
                    filename: filename,
                    title: getTitle(tags.title, filename),
                    duration: tags.duration,
                    artist: tagOrDefault(tags.artist, ''),
                    album: tagOrDefault(tags.album, ''),
                    genre: tagOrDefault(tags.genre, ''),
                    year: tagOrDefault(tags.year, ''),
                    track_num: tags.track.no,
                    track_total: tags.track.of,
                    disc_num: tags.disk.no,
                    disc_total: tags.disk.of
                };

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

            parser.on('done', function(err) {
                if (err) {
                    console.log(err);
                    stream.destroy();
                }
            });
        });
    });
}

// -- Indexer helper functions
function getTitle(title, filename) {
    if (!(title == null || title == '')) {
        return title;
    }

    var filetitle = path.basename(data.filename).match(/^\d+ (.*)\..*/);
    if (filetitle != null && filetitle.length > 1) {
        return filetitle[1];
    }
}
function tagOrDefault(tag, def) {
    if (tag == '') {
        return def;
    }
    return tag;
}

